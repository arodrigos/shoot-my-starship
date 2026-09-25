import Phaser from "phaser";
import { integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { acumuladorInicial, avanzarConAcumulador, PASO_FIJO_MS, type EstadoAcumulador } from "@/sim/tiempo";

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
  ): void {
    this.proyectil = inicial;
    this.gravedad = gravedad;
    this.deriva = deriva;
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
    let detenido = false;
    const resultado = avanzarConAcumulador(this.proyectil, this.acumulador, deltaMs, (p) => {
      if (detenido) {
        return p;
      }
      const siguiente = integrarPasoProyectil(p, this.gravedad, this.deriva, PASO_FIJO_S);
      if (detenerse(siguiente)) {
        detenido = true;
      }
      return siguiente;
    });
    this.proyectil = resultado.estado;
    this.acumulador = resultado.acumulador;
    this.punto.setPosition(this.proyectil.x, this.proyectil.y);

    if (this.detenerse(this.proyectil)) {
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
