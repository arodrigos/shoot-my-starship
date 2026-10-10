import Phaser from "phaser";
import { GRAVEDAD_REFERENCIA_PX_S2, integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { acumuladorInicial, avanzarConAcumulador, PASO_FIJO_MS, type EstadoAcumulador } from "@/sim/tiempo";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { fueraDeEncuadre, PRESUPUESTO_VUELO_MULTIPOZO_PASOS, type EncuadreVuelo } from "@/sim/fisica/vuelo";
import type { RastreadorImpactoNaves } from "@/sim/naves/impacto";
import type { Arma } from "@/sim/armas/tipos";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { puntosSilueta } from "@/juego/proyectiles/geometriaProyectil";
import { siguientePerturbacionErratica } from "@/sim/fisica/comportamientoExtendido";
import type { EstadoAleatorio } from "@/sim/aleatorio";
import { FRACCION_CRUZ_SUBMUNICION, RADIO_SUBMUNICION } from "@/sim/armas/resolver";

const PASO_FIJO_S = PASO_FIJO_MS / 1000;

const COLOR_PROYECTIL = 0xffe08a;
const COLOR_SOMBRA_PROYECTIL = 0x2a1c00;

// Distancia al punto de impacto a la que el Racimo se abre en sus cinco
// perdigones: lo bastante corta para que se lea como una escopeta y no como
// cinco disparos distintos.
export const DISTANCIA_APERTURA_PERDIGONES_U = 40;
const RADIO_PERDIGON_PX = 3;

// Reproduce en el cliente EXACTAMENTE el mismo paso fijo que ya resolvió el
// disparo en el núcleo (integrarPasoProyectil, avanzarConAcumulador): no es
// una animación aproximada ni una física de juguete aparte, es la misma
// función pura ejecutada de nuevo con las mismas condiciones iniciales, así
// que el punto donde la vista deja de moverse coincide con el impacto real
// sin tener que hacer viajar la trayectoria completa por la red ni guardarla
// en el estado serializable.
export class AnimadorProyectil {
  // proyectiles-visibles (proy-1/proy-2): silueta poligonal por arma, no un
  // punto -- se redibuja UNA vez por disparo (la forma no cambia en vuelo,
  // solo su rotación) y se orienta cada fotograma con el vector velocidad
  // real, nunca con una animación de rotación aparte.
  private readonly punto: Phaser.GameObjects.Graphics;
  private anguloActualRad = 0;
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
  // salida-pantalla: el núcleo ya declaró perdido el tiro que sale del
  // encuadre; sin esto la vista seguía animando el vuelo fuera de pantalla
  // hasta agotar el presupuesto (segundos de pantalla quieta, que además
  // retrasan el turno en un CI con render por software).
  private encuadre: EncuadreVuelo | undefined;
  private detenerse: ((p: EstadoProyectil) => boolean) | null = null;
  private alTerminar: ((p: EstadoProyectil) => void) | null = null;
  // impacto-naves (desviación, ver entregable): sin esto la vista no sabía
  // que un casco puede terminar el vuelo antes que el suelo o el
  // presupuesto -- seguía animando hasta agotar el presupuesto multipozo
  // (~12s simulados) aunque el núcleo ya hubiera resuelto el impacto de
  // casco muchos pasos antes, congelando el turno en cliente con WebGL por
  // software.
  private rastreadorNaves: RastreadorImpactoNaves | undefined;
  // proy-4/proy-5: el arma con la que se disparó este vuelo -- para que la
  // estela sepa de dónde salir y el debug de visibilidad pueda comprobar que
  // la silueta que ve el jugador corresponde al arma seleccionada.
  private armaActual: Arma | undefined;
  // arma-mosca (mos-3): reproduce EXACTAMENTE la misma perturbación por paso
  // que ya consumió el núcleo al resolver este disparo (comportamientoExtendido.ts,
  // la misma función que usa vuelo.ts) -- nunca una ondulación decorativa
  // aparte, que es justo lo que este criterio prohíbe. null/0 en cualquier
  // arma sin comportamiento "erratico": el resto del catálogo anima igual
  // que antes de este bloque.
  private aleatorioPerturbacion: EstadoAleatorio | null = null;
  private magnitudPerturbacion = 0;
  // mos-2 (fix): memoria de velocidad lateral del Ornstein-Uhlenbeck discreto
  // de siguientePerturbacionErratica -- debe arrancar en reposo igual que en
  // vuelo.ts para que animación y resolución telescopen la misma trayectoria.
  private velocidadLateralXPxS = 0;
  private velocidadLateralYPxS = 0;
  // arma-granada-espoleta (gra-2, gra-4): pasos de simulación ya integrados
  // desde el disparo para un arma "mecha", contados por ESTE bucle -- nunca
  // contando cuántas veces se invoca `detenerse`, porque ese callback recibe
  // una llamada extra por fotograma en la línea de cierre de actualizar()
  // (el chequeo final tras el lote), lo que doblaría la cuenta y volvería el
  // temporizador dependiente del framerate, justo lo que gra-4 prohíbe.
  // pasosHastaDetonarMecha viene ya convertido por pasosDeMecha() (núcleo),
  // así que la conversión segundos->pasos es la MISMA en cliente y servidor.
  private pasosMecha = 0;
  private pasosHastaDetonarMecha: number | null = null;
  // arma-mina-adherente (min-1, min-2, min-4): campos SEPARADOS de los de la
  // granada (pasosMecha/pasosHastaDetonarMecha), a propósito -- reutilizar
  // los mismos habría disparado el HUD de la espoleta (CuentaAtrasHUD, panel
  // fijo de esquina) para la mina, que min-2 exige anclada al mundo y
  // explícitamente fuera del HUD. `adherido` pasa a true en el primer
  // contacto (o al agotar el presupuesto de vuelo, igual que el núcleo) y a
  // partir de ahí la física se congela: el proyectil no vuelve a moverse,
  // solo cuenta pasos fijos hasta pasosHastaDetonarTrasAdherencia.
  private adherido = false;
  private pasosAdherencia = 0;
  private pasosHastaDetonarTrasAdherencia: number | null = null;
  // mos-1/mos-3: la posición inicial y la de cada paso animado, en el mismo
  // orden que las recorre este bucle -- expuesta a window.__debug (ver
  // Partida.ts) para que el e2e compare, paso a paso, contra
  // ResultadoVuelo.trayectoria del mismo disparo resuelto por el núcleo.
  private trayectoria: EstadoProyectil[] = [];
  // racimo-perdigones: punto donde el portador detona (lo resolvió el
  // núcleo) y nº de perdigones; null en cualquier otra arma. Los perdigones
  // son solo dibujo: la colisión y el daño ya los decidió el núcleo.
  private racimo: { readonly destino: { readonly x: number; readonly y: number }; readonly cantidad: number } | null = null;
  private perdigonesVisibles = 1;
  // Máximo de perdigones de este vuelo, medido en cada paso fijo y no por
  // fotograma: con render por software un fotograma recorre más de 40 u y se
  // saltaría la ventana de apertura, aunque en el vuelo sí se haya abierto.
  private perdigonesMaximo = 1;
  private readonly graficoPerdigones: Phaser.GameObjects.Graphics;
  // armas-aspecto: con una textura horneada por arma (VisualArmas) el polígono
  // plano de abajo ya no se enseña; sigue existiendo como respaldo para las
  // escenas sin texturas (pruebas, Siluetas).
  private texturaExterna = false;

  constructor(escena: Phaser.Scene) {
    this.punto = escena.add.graphics().setVisible(false).setDepth(50);
    this.graficoPerdigones = escena.add.graphics().setVisible(false).setDepth(50);
  }

  usarTexturaExterna(valor: boolean): void {
    this.texturaExterna = valor;
  }

  // Debe llamarse antes de iniciar(); iniciar() no lo borra para que la
  // repetición (que reutiliza el vuelo) también se vea abrirse.
  fijarRacimo(racimo: { readonly destino: { readonly x: number; readonly y: number }; readonly cantidad: number } | null): void {
    this.racimo = racimo;
  }

  // 1 mientras el portador vuela entero; la cantidad del Racimo cuando quedan
  // <= DISTANCIA_APERTURA_PERDIGONES_U al impacto.
  obtenerPerdigones(): number {
    return this.proyectil ? this.perdigonesVisibles : 0;
  }

  obtenerPerdigonesMaximo(): number {
    return this.perdigonesMaximo;
  }

  private actualizarPerdigones(): void {
    const p = this.proyectil;
    if (!this.racimo || !p) {
      this.perdigonesVisibles = 1;
      this.graficoPerdigones.setVisible(false);
      return;
    }
    const restante = Math.hypot(p.x - this.racimo.destino.x, p.y - this.racimo.destino.y);
    if (restante > DISTANCIA_APERTURA_PERDIGONES_U) {
      this.perdigonesVisibles = 1;
      this.graficoPerdigones.setVisible(false);
      return;
    }
    this.perdigonesVisibles = this.racimo.cantidad;
    // La cruz se abre de 0 a su alcance final a medida que se acerca: la misma
    // forma (centro más cruz con el rumbo) que detonará en el núcleo.
    const apertura = (1 - restante / DISTANCIA_APERTURA_PERDIGONES_U) * RADIO_SUBMUNICION * FRACCION_CRUZ_SUBMUNICION;
    const rumbo = Math.atan2(p.vy, p.vx);
    const brazos = Math.max(1, this.racimo.cantidad - 1);
    this.punto.setVisible(false);
    this.graficoPerdigones.clear().setVisible(true).fillStyle(COLOR_PROYECTIL, 1);
    for (let i = 0; i < this.racimo.cantidad; i++) {
      const angulo = rumbo + ((i - 1) * 2 * Math.PI) / brazos;
      const d = i === 0 ? 0 : apertura;
      this.graficoPerdigones.fillCircle(p.x + Math.cos(angulo) * d, p.y + Math.sin(angulo) * d, RADIO_PERDIGON_PX);
    }
  }

  obtenerTrayectoria(): readonly EstadoProyectil[] {
    return this.trayectoria;
  }

  enVuelo(): boolean {
    return this.proyectil !== null;
  }

  // proy-4/proy-5: posición y arma del vuelo en curso, para que Partida.ts
  // pueda emitir la estela y exponer el punto real al debug sin que este
  // módulo tenga que saber nada de Phaser Particles ni de window.__debug.
  obtenerPosicion(): { x: number; y: number } | null {
    return this.proyectil ? { x: this.proyectil.x, y: this.proyectil.y } : null;
  }

  obtenerArmaId(): string | undefined {
    return this.armaActual?.id;
  }

  // arma-granada-espoleta (gra-2): segundos que le quedan a la espoleta
  // AHORA MISMO, derivados de pasos ya integrados (nunca de un reloj de
  // pantalla) -- null fuera de un vuelo "mecha". Redondeado hacia arriba para
  // que solo llegue a 0 en el mismo paso en el que detona (gra-2 exige que
  // el contador toque cero en el mismo fotograma que la explosión, no antes).
  obtenerSegundosRestantesMecha(): number | null {
    if (this.pasosHastaDetonarMecha === null) {
      return null;
    }
    const pasosRestantes = Math.max(0, this.pasosHastaDetonarMecha - this.pasosMecha);
    return Math.ceil(pasosRestantes * PASO_FIJO_S);
  }

  // arma-mina-adherente (min-1, min-2): true en cuanto el proyectil se ha
  // pegado a su punto de contacto (o agotó su presupuesto de vuelo sin
  // tocar nada, ver resolver.ts) y está contando la mecha de la adherencia
  // -- la posición ya no se mueve (obtenerPosicion() devuelve el punto de
  // adherencia exacto) aunque el vuelo formalmente no haya terminado.
  estaAdherido(): boolean {
    return this.adherido;
  }

  // arma-mina-adherente (min-2, min-5): segundos que le quedan a la mina
  // DESDE QUE SE PEGÓ -- nunca desde el disparo, a diferencia de
  // obtenerSegundosRestantesMecha. null si este vuelo no es de una mina o
  // todavía no se ha adherido a nada.
  obtenerSegundosRestantesAdherencia(): number | null {
    if (!this.adherido || this.pasosHastaDetonarTrasAdherencia === null) {
      return null;
    }
    const pasosRestantes = Math.max(0, this.pasosHastaDetonarTrasAdherencia - this.pasosAdherencia);
    return Math.ceil(pasosRestantes * PASO_FIJO_S);
  }

  // Dibuja la silueta local del arma (morro en +x) UNA sola vez por
  // disparo: dibujarla cada fotograma sería redibujar un polígono que no
  // cambia de forma, solo de orientación (eso lo hace setRotation).
  private dibujarSilueta(arma: Arma | undefined): void {
    const puntos = puntosSilueta(arma ?? CATALOGO_ARMAS[0]).map((p) => new Phaser.Math.Vector2(p.x, p.y));
    this.punto.clear();
    this.punto.fillStyle(COLOR_SOMBRA_PROYECTIL, 1);
    this.punto.fillPoints(
      puntos.map((p) => new Phaser.Math.Vector2(p.x + 1, p.y + 1)),
      true,
    );
    this.punto.fillStyle(COLOR_PROYECTIL, 1);
    this.punto.fillPoints(puntos, true);
  }

  iniciar(
    inicial: EstadoProyectil,
    gravedad: number,
    deriva: number,
    detenerse: (p: EstadoProyectil) => boolean,
    alTerminar: (p: EstadoProyectil) => void,
    planetas?: RegistroPlanetas,
    rastreadorNaves?: RastreadorImpactoNaves,
    arma?: Arma,
    // arma-mosca (mos-3): el MISMO EstadoAleatorio hilvanado que el núcleo
    // usó como semilla de la perturbación de este disparo -- Partida.ts lo
    // saca de estadoAntes.aleatorio, previo a la tirada. Opcional y aditivo:
    // sin él (todo llamante de un arma que no sea "erratico"), el
    // comportamiento es exactamente el de siempre.
    perturbacion?: { readonly magnitudPxS2: number; readonly aleatorio: EstadoAleatorio },
    // arma-granada-espoleta (gra-1, gra-4): pasosDeMecha(segundosHastaDetonar)
    // ya resuelto por el llamante (Partida.ts, que es quien conoce el arma) --
    // este módulo no necesita saber qué arma es "mecha", solo cuántos pasos
    // de simulación le quedan. undefined en cualquier vuelo sin mecha: el
    // resto del catálogo anima igual que antes de este bloque.
    pasosHastaDetonarMecha?: number,
    // arma-mina-adherente (min-1, min-4): pasosDeMecha(segundosHastaDetonar)
    // ya resuelto por el llamante (Partida.ts), igual que pasosHastaDetonarMecha
    // -- este módulo no necesita saber qué arma es la mina, solo cuántos
    // pasos de simulación cuenta tras adherirse. undefined en cualquier
    // vuelo que no sea de la mina: el resto del catálogo anima igual que
    // antes de este bloque.
    pasosHastaDetonarTrasAdherencia?: number,
  ): void {
    this.proyectil = inicial;
    this.gravedad = gravedad;
    this.deriva = deriva;
    this.planetas = planetas && planetas.length > 0 ? planetas : undefined;
    this.pasos = 0;
    this.detenerse = detenerse;
    this.alTerminar = alTerminar;
    this.rastreadorNaves = rastreadorNaves;
    this.armaActual = arma;
    this.aleatorioPerturbacion = perturbacion?.aleatorio ?? null;
    this.magnitudPerturbacion = perturbacion?.magnitudPxS2 ?? 0;
    this.velocidadLateralXPxS = 0;
    this.velocidadLateralYPxS = 0;
    this.pasosMecha = 0;
    this.pasosHastaDetonarMecha = pasosHastaDetonarMecha ?? null;
    this.adherido = false;
    this.pasosAdherencia = 0;
    this.pasosHastaDetonarTrasAdherencia = pasosHastaDetonarTrasAdherencia ?? null;
    this.trayectoria = [inicial];
    this.acumulador = acumuladorInicial();
    this.anguloActualRad = Math.atan2(inicial.vy, inicial.vx);
    this.dibujarSilueta(arma);
    this.perdigonesVisibles = 1;
    this.perdigonesMaximo = 1;
    this.graficoPerdigones.setVisible(false);
    this.punto.setPosition(inicial.x, inicial.y).setRotation(this.anguloActualRad).setVisible(!this.texturaExterna);
  }

  fijarEncuadre(encuadre: EncuadreVuelo): void {
    this.encuadre = encuadre;
  }

  obtenerObjetoDeCamara(): Phaser.GameObjects.Graphics {
    return this.punto;
  }

  // proy-2: el ángulo que de verdad se aplicó al objeto de render en el
  // último fotograma -- expuesto para que el test compare contra
  // atan2(vy, vx) sin tener que leer la rotación de un GameObject real.
  obtenerAnguloActual(): number {
    return this.anguloActualRad;
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
    const rastreadorNaves = this.rastreadorNaves;
    const encuadre = this.encuadre;
    let detenido = false;
    let agotado = false;
    let huboImpactoNave = false;
    let huboDetonacionMecha = false;
    let huboDetonacionAdherencia = false;
    const resultado = avanzarConAcumulador(this.proyectil, this.acumulador, deltaMs, (p) => {
      if (detenido) {
        return p;
      }
      // arma-mina-adherente (min-1, min-4): una vez pegada, la física deja de
      // avanzar -- solo se cuentan pasos fijos (mismo truco que pasosMecha)
      // hasta pasosHastaDetonarTrasAdherencia. Va ANTES que cualquier otra
      // comprobación: mientras se cuenta, ni el presupuesto multipozo ni
      // detenerse() tienen nada que decidir, la posición ya está congelada.
      if (this.adherido) {
        this.pasosAdherencia++;
        if (this.pasosHastaDetonarTrasAdherencia !== null && this.pasosAdherencia >= this.pasosHastaDetonarTrasAdherencia) {
          detenido = true;
          huboDetonacionAdherencia = true;
        }
        return p;
      }
      // Mismo orden que el bucle de simularVuelo (vuelo.ts): el presupuesto
      // se comprueba ANTES de dar el paso -- así el número total de pasos
      // dados (y por tanto la posición final en el caso perdido) coincide
      // exactamente con el del núcleo, que ya resolvió este mismo disparo de
      // forma síncrona antes de que arrancara esta animación.
      if (planetas && this.pasos >= PRESUPUESTO_VUELO_MULTIPOZO_PASOS) {
        // arma-mina-adherente (min-1): el núcleo (resolver.ts) ya detona la
        // mina en la última posición conocida cuando se agota el
        // presupuesto sin contacto -- la vista hace lo mismo: se congela
        // aquí y cuenta, en vez de declararse "perdida" como el resto del
        // catálogo.
        if (this.pasosHastaDetonarTrasAdherencia !== null) {
          this.adherido = true;
          return p;
        }
        detenido = true;
        agotado = true;
        return p;
      }
      // Mismo truco que simularVuelo: la aceleración de N cuerpos recalculada
      // en cada paso se disfraza de gravedad/deriva de ESE paso, para
      // reutilizar integrarPasoProyectil tal cual en vez de bifurcar el
      // integrador entre núcleo y vista.
      let [gravedadPaso, derivaPaso] = planetas
        ? (() => {
            const aceleracion = calcularAceleracionGravitatoria(planetas, p.x, p.y);
            return [this.gravedad + aceleracion.y / GRAVEDAD_REFERENCIA_PX_S2, this.deriva + aceleracion.x] as const;
          })()
        : ([this.gravedad, this.deriva] as const);
      // arma-mosca (mos-3): misma perturbación, mismo orden (deriva antes que
      // gravedad) y misma función que consume vuelo.ts -- ver el comentario
      // de campo de aleatorioPerturbacion más arriba.
      if (this.aleatorioPerturbacion !== null && this.magnitudPerturbacion !== 0) {
        const perturbacion = siguientePerturbacionErratica(
          this.aleatorioPerturbacion,
          this.magnitudPerturbacion,
          this.velocidadLateralXPxS,
          this.velocidadLateralYPxS,
        );
        this.aleatorioPerturbacion = perturbacion.estado;
        this.velocidadLateralXPxS = perturbacion.velocidadLateralXPxS;
        this.velocidadLateralYPxS = perturbacion.velocidadLateralYPxS;
        gravedadPaso += perturbacion.gravedadExtra;
        derivaPaso += perturbacion.derivaPxS2;
      }
      const siguiente = integrarPasoProyectil(p, gravedadPaso, derivaPaso, PASO_FIJO_S);
      this.trayectoria.push(siguiente);
      if (
        this.racimo &&
        Math.hypot(siguiente.x - this.racimo.destino.x, siguiente.y - this.racimo.destino.y) <= DISTANCIA_APERTURA_PERDIGONES_U
      ) {
        this.perdigonesMaximo = this.racimo.cantidad;
      }
      if (planetas) this.pasos++;
      // Misma regla que simularVuelo: un vuelo que sale del encuadre se pierde
      // sin detonar, así que la animación termina en el mismo punto.
      if (encuadre && fueraDeEncuadre(siguiente.x, siguiente.y, encuadre.ancho, encuadre.alto)) {
        detenido = true;
        agotado = true;
        return siguiente;
      }
      // Mismo orden que simularVuelo: el casco se comprueba en cada paso,
      // por delante del propio detenerse() de terreno -- así el impacto de
      // casco siempre gana cuando el mismo paso cruza los dos.
      if (rastreadorNaves?.comprobarPaso(p, siguiente)) {
        // arma-mina-adherente (min-1): el contacto con un casco pega la
        // mina en vez de terminar el vuelo -- se congela aquí (siguiente,
        // el punto de corte real) y a partir del próximo paso entra por la
        // rama `this.adherido` de arriba.
        if (this.pasosHastaDetonarTrasAdherencia !== null) {
          this.adherido = true;
          return siguiente;
        }
        detenido = true;
        huboImpactoNave = true;
        return siguiente;
      }
      if (detenerse(siguiente)) {
        // arma-mina-adherente (min-1): mismo criterio que el impacto de
        // casco -- el contacto con terreno sólido pega en vez de terminar.
        if (this.pasosHastaDetonarTrasAdherencia !== null && estaDentroDelMundo(siguiente, encuadre)) {
          this.adherido = true;
        } else {
          // Fuera del mundo no hay roca a la que agarrarse: el núcleo lo da
          // por perdido (como a cualquier otra arma), así que aquí se corta
          // el vuelo sin contador ni detonación.
          detenido = true;
          if (this.pasosHastaDetonarTrasAdherencia !== null) agotado = true;
        }
      }
      // arma-granada-espoleta (gra-1): mismo orden de precedencia que
      // crearDetenerseConMecha en el núcleo (resolver.ts) -- el contacto de
      // terreno/casco de ESTE mismo paso gana si ya paró la animación; el
      // temporizador solo cuenta (y solo puede detonar) cuando ese contacto
      // no ha ocurrido todavía, para que "detona en tierra si el contacto
      // llega antes, en el aire si el reloj gana" sea idéntico en cliente y
      // servidor.
      if (!detenido && !this.adherido && this.pasosHastaDetonarMecha !== null) {
        this.pasosMecha++;
        if (this.pasosMecha >= this.pasosHastaDetonarMecha) {
          detenido = true;
          huboDetonacionMecha = true;
        }
      }
      return siguiente;
    });
    this.proyectil = resultado.estado;
    this.acumulador = resultado.acumulador;
    this.anguloActualRad = Math.atan2(this.proyectil.vy, this.proyectil.vx);
    this.punto.setPosition(this.proyectil.x, this.proyectil.y).setRotation(this.anguloActualRad);
    this.actualizarPerdigones();

    // arma-mina-adherente (min-1, min-2): mientras se está contando la
    // adherencia, el catch-all final de abajo (this.detenerse(this.proyectil))
    // sería SIEMPRE verdadero -- la mina está congelada justo encima del
    // contacto que ya satisface esa condición -- así que terminaría la
    // animación en el primer fotograma tras pegarse, antes de contar nada.
    // Se excluye explícitamente mientras `adherido` sigue sin haber
    // detonado todavía.
    const contandoAdherencia = this.adherido && !huboDetonacionAdherencia;
    if (!contandoAdherencia && (agotado || huboImpactoNave || huboDetonacionMecha || huboDetonacionAdherencia || this.detenerse(this.proyectil))) {
      const final = this.proyectil;
      const callback = this.alTerminar;
      this.proyectil = null;
      this.detenerse = null;
      this.alTerminar = null;
      this.punto.setVisible(false);
      this.graficoPerdigones.setVisible(false);
      this.perdigonesVisibles = 1;
      callback?.(final);
    }
  }
}

// El gancho solo se agarra dentro del mundo: el mismo recinto que usa el
// núcleo (estaAnclado) para decidir si lo pierde.
function estaDentroDelMundo(p: EstadoProyectil, encuadre: EncuadreVuelo | undefined): boolean {
  if (!encuadre) return true;
  return p.x >= 0 && p.x < encuadre.ancho && p.y >= 0 && p.y < encuadre.alto;
}
