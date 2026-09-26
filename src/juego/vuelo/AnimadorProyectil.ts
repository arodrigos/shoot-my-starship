import Phaser from "phaser";
import { GRAVEDAD_REFERENCIA_PX_S2, integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { acumuladorInicial, avanzarConAcumulador, PASO_FIJO_MS, type EstadoAcumulador } from "@/sim/tiempo";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { PRESUPUESTO_VUELO_MULTIPOZO_PASOS } from "@/sim/fisica/vuelo";

const PASO_FIJO_S = PASO_FIJO_MS / 1000;

const COLOR_PROYECTIL = 0xffe08a;
const RADIO_PROYECTIL_PX = 5;

// Reproduce en el cliente EXACTAMENTE el mismo paso fijo que ya resolvió el
// disparo en el núcleo (integrarPasoProyectil, avanzarConAcumulador): no es
// una animación aproximada ni una física de juguete aparte, es la misma
// función pura ejecutada de nuevo con las mismas condiciones iniciales, así
// que el punto donde la vista deja de moverse coincide con el impacto real
// sin tener que hacer viajar la trayectoria completa por la red ni guardarla
// en el estado serializable.
export class AnimadorProyectil {
  private readonly punto: Phaser.GameObjects.Arc;
  private proyectil: EstadoProyectil | null = null;
  private acumulador: EstadoAcumulador = acumuladorInicial();
  private gravedad = 0;
  private deriva = 0;
  // render-espacio (esp-1): sin esto, la vista solo reproducía la gravedad
  // ambiente (0 en el vacío) y el disparo se veía volar en línea recta
  // aunque simularVuelo (el cálculo real que decide dónde impacta) sí
  // curvara por los planetas -- exactamente la clase de desincronización
  // vista/núcleo que este bloque no puede permitirse en su propio hito.
  private planetas: RegistroPlanetas | undefined;
  // grav-6/esp-1: mismo presupuesto de pasos que simularVuelo -- sin él, un
  // disparo que de verdad entra en órbita estable animaría para siempre en
  // vez de declararse perdido en el mismo paso donde lo hace el núcleo.
  private pasos = 0;
  private detenerse: ((p: EstadoProyectil) => boolean) | null = null;
  private alTerminar: ((p: EstadoProyectil) => void) | null = null;

  constructor(escena: Phaser.Scene) {
    this.punto = escena.add.circle(0, 0, RADIO_PROYECTIL_PX, COLOR_PROYECTIL).setVisible(false).setDepth(50);
  }

  enVuelo(): boolean {
    return this.proyectil !== null;
  }

  iniciar(
    inicial: EstadoProyectil,
    gravedad: number,
    deriva: number,
    detenerse: (p: EstadoProyectil) => boolean,
    alTerminar: (p: EstadoProyectil) => void,
    planetas?: RegistroPlanetas,
  ): void {
    this.proyectil = inicial;
    this.gravedad = gravedad;
    this.deriva = deriva;
    this.planetas = planetas && planetas.length > 0 ? planetas : undefined;
    this.pasos = 0;
    this.detenerse = detenerse;
    this.alTerminar = alTerminar;
    this.acumulador = acumuladorInicial();
    this.punto.setPosition(inicial.x, inicial.y).setVisible(true);
  }

  obtenerObjetoDeCamara(): Phaser.GameObjects.Arc {
    return this.punto;
  }

  // Llamado desde Scene.update(time, delta): avanza tantos pasos fijos como
  // quepan en delta, nunca uno por fotograma -- lo mismo que evita que el
  // disparo real dependa del framerate (nucleo-1) evita que la ANIMACIÓN
  // dependa de él.
  actualizar(deltaMs: number): void {
    if (this.proyectil === null || this.detenerse === null) {
      return;
    }

    // humor-6 (desviación, ver entregable): avanzarConAcumulador por sí solo
    // ejecuta TODOS los pasos fijos que quepan en delta antes de que nadie
    // mire detenerse(), así que un fotograma que agrupa varios pasos puede
    // colar el proyectil de largo más allá del punto de impacto real -- y
    // cuánto se cuela varía con el reparto real de fotogramas, que nunca es
    // igual entre dos repeticiones en vivo del mismo vuelo (la original y la
    // que dispara reproducirRepeticion). Se corta el avance en cuanto
    // detenerse() da true DENTRO del propio lote, no después: los pasos
    // sobrantes del lote se descartan (paso() se vuelve un no-op) para que el
    // punto final sea el mismo primer cruce fijo, sin importar cuántos pasos
    // más quedaran acumulados en ese fotograma.
    const detenerse = this.detenerse;
    const planetas = this.planetas;
    let detenido = false;
    let agotado = false;
    const resultado = avanzarConAcumulador(this.proyectil, this.acumulador, deltaMs, (p) => {
      if (detenido) {
        return p;
      }
      // Mismo orden que el bucle de simularVuelo (vuelo.ts): el presupuesto
      // se comprueba ANTES de dar el paso -- así el número total de pasos
      // dados (y por tanto la posición final en el caso perdido) coincide
      // exactamente con el del núcleo, que ya resolvió este mismo disparo de
      // forma síncrona antes de que arrancara esta animación.
      if (planetas && this.pasos >= PRESUPUESTO_VUELO_MULTIPOZO_PASOS) {
        detenido = true;
        agotado = true;
        return p;
      }
      // Mismo truco que simularVuelo: la aceleración de N cuerpos recalculada
      // en cada paso se disfraza de gravedad/deriva de ESE paso, para
      // reutilizar integrarPasoProyectil tal cual en vez de bifurcar el
      // integrador entre núcleo y vista.
      const [gravedadPaso, derivaPaso] = planetas
        ? (() => {
            const aceleracion = calcularAceleracionGravitatoria(planetas, p.x, p.y);
            return [this.gravedad + aceleracion.y / GRAVEDAD_REFERENCIA_PX_S2, this.deriva + aceleracion.x] as const;
          })()
        : ([this.gravedad, this.deriva] as const);
      const siguiente = integrarPasoProyectil(p, gravedadPaso, derivaPaso, PASO_FIJO_S);
      if (planetas) this.pasos++;
      if (detenerse(siguiente)) {
        detenido = true;
      }
      return siguiente;
    });
    this.proyectil = resultado.estado;
    this.acumulador = resultado.acumulador;
    this.punto.setPosition(this.proyectil.x, this.proyectil.y);

    if (agotado || this.detenerse(this.proyectil)) {
      const final = this.proyectil;
      const callback = this.alTerminar;
      this.proyectil = null;
      this.detenerse = null;
      this.alTerminar = null;
      this.punto.setVisible(false);
      callback?.(final);
    }
  }
}
