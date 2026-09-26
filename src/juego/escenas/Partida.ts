import Phaser from "phaser";
import { MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { generarMascara } from "@/sim/terreno/generador";
import { crearTerrenoPhaser } from "@/juego/terreno/crearTerrenoPhaser";
import { crearTerrenoEspacioPhaser } from "@/juego/terreno/crearTerrenoEspacioPhaser";
import { crearFondoEspacial } from "@/juego/fondo/FondoEspacial";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { colocarNaves } from "@/sim/naves/colocacion";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearPartidaInicial, jugarTurno } from "@/sim/partida/motor";
import { avanzar } from "@/sim/partida/avanzar";
import type { EntradaDeTurno, EstadoPartida, IdNave, ParametrosMundo } from "@/sim/partida/tipos";
import { TIPOS_EVENTO_HUMOR, type EventoSimulacion, type TipoEventoHumor } from "@/sim/partida/eventos";
import { alturaSuperficie, detenerseEnSuelo, ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { naveContraria } from "@/sim/partida/tipos";
import { contarPixelesDestruidos } from "@/sim/terreno/estadisticas";
import { estadisticasIniciales, generarParteDeGuerra, type EstadisticasPartida } from "@/sim/partida/parteDeGuerra";
import { buscarMapa, SEMILLA_SISTEMA_POR_DEFECTO } from "@/juego/mundos/mapas";
import { Nave } from "@/juego/naves/Nave";
import { IndicadorDeriva } from "@/juego/deriva/IndicadorDeriva";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { LA_CONTABLE, ALMIRANTE_BISAGRA, buscarPersonalidad } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import { UMBRAL_FALLO_PX, type UltimoIntentoIA } from "@/sim/ia/decidir";
import { exponerDepuracionDeTerreno } from "@/juego/depuracion/exponerTerreno";
import {
  fijarModoEspacial,
  publicarDisparoJugadorResuelto,
  publicarJugable,
  registrarManejadorDisparo,
  reiniciarControl,
} from "@/juego/control/store";
import { limpiarReaccion, publicarReaccion, registrarManejadorRepeticion } from "@/juego/control/reaccion";
import { limpiarParteDeGuerra, publicarParteDeGuerra } from "@/juego/control/parteDeGuerraStore";
import { publicarResultadoTurno, reiniciarResultadoTurno } from "@/juego/control/resultadoTurnoStore";
import { guardarUltimaPartida } from "@/juego/control/progreso";
import { crearSelectorFrases, type SelectorFrases } from "@/contenido/selectorFrases";
import { desbloquearAudio, estadoAudioActual, pausarAudio, reanudarAudio, reproducirTono } from "@/juego/audio/motor";
import type { DatosEscenaPartida } from "@/juego/main";
import "@/debug/tipos";

// render-espacio (esp-6): el texto del panel "resultado del turno" -- un
// mensaje propio para "proyectil perdido en órbita" (grav-6), porque ese
// turno no tiene ni impacto ni fallo que describir con el resto de casos.
function resumenTurno(eventos: readonly EventoSimulacion[]): string {
  if (eventos.some((evento) => evento.tipo === "proyectil-perdido")) {
    return "Tu disparo se ha quedado atrapado en órbita, sin caer nunca. El turno pasa igual.";
  }
  if (eventos.some((evento) => evento.tipo === "arma-falla")) {
    return "El arma ha fallado: ni huella ni daño este turno.";
  }
  const impacto = eventos.find(
    (evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> => evento.tipo === "impacto",
  );
  if (impacto) {
    return impacto.danio > 0 ? `Impacto directo: ${impacto.danio} de daño.` : "El disparo ha caído sin hacer daño.";
  }
  return "Turno resuelto.";
}

// humor-sistemico: qué reacción (sacudida, tono, frase) dispara cada disparo
// resuelto -- un evento es "de humor" si su tipo está en TIPOS_EVENTO_HUMOR,
// nunca por una lista propia que pueda desincronizarse de eventos.ts.
const CONJUNTO_TIPOS_EVENTO_HUMOR = new Set<string>(TIPOS_EVENTO_HUMOR);

function esEventoHumor(evento: EventoSimulacion): evento is Extract<EventoSimulacion, { tipo: TipoEventoHumor }> {
  return CONJUNTO_TIPOS_EVENTO_HUMOR.has(evento.tipo);
}

// humor-2: construye un evento mínimo válido de cada tipo de humor, solo
// para window.__debug.dispararReaccionHumor -- fabricar por juego real las
// condiciones de los 7 (deriva, derrumbe, entierro, caída al vacío, tiro
// imposible...) exigiría escenarios de física distintos y frágiles por tipo;
// el contenido exacto de los campos no importa porque reaccionarAHumor y el
// selector de frases solo miran evento.tipo (y, para arma-falla, evento.arma,
// que existe en el catálogo real).
function crearEventoDePruebaHumor(tipo: TipoEventoHumor): Extract<EventoSimulacion, { tipo: TipoEventoHumor }> {
  switch (tipo) {
    case "autoimpacto":
      return { tipo, nave: 0, danio: 1 };
    case "arma-falla":
      return { tipo, nave: 0, arma: "Despedida" };
    case "tiro-imposible-acertado":
      return { tipo, nave: 0, objetivo: 1 };
    case "deriva-traiciona":
    case "derrumbe-bajo-el-lider":
    case "enterrado":
    case "caida-al-vacio":
      return { tipo, nave: 0 };
  }
}

const DURACION_SACUDIDA_MS = 220;
const INTENSIDAD_SACUDIDA = 0.012;

// El jugador local es siempre la nave 0 (la de la izquierda, FRACCION_X_NAVE_0)
// y la máquina la nave 1 -- válido mientras solo haya un humano por partida
// (brief); el multijugador remoto, si llega, es decisión de otro bloque.
const ID_JUGADOR: IdNave = 0;
// Rival por defecto si la escena arranca sin datos de inicio (navegación
// directa a "/?mapa=..." de los tests e2e de bloques anteriores, que no
// pasan por la pantalla de inicio): La Contable, el mismo que ya usaba
// jugarTurnosGuionizados como referencia antes de partida-completa.
const RIVAL_POR_DEFECTO = LA_CONTABLE;
// Despedida hace autodaño garantizado (fiabilidad 1) además de daño de área:
// forzarFinDePartida() la usa a propósito, porque eso pone una cota dura al
// número de turnos hasta que alguien llega a 0 -- ningún matchup de IA
// puede alargarla indefinidamente, a diferencia de jugarTurnosGuionizados
// (ver desviaciones: la IA La Contable contra Almirante Bisagra no converge
// en 200 turnos en el mapa por defecto).
const ARMA_DESENLACE = "despedida";
const TOPE_TURNOS_DESENLACE = 12;

const FRACCION_X_NAVE_0 = 0.15;
const FRACCION_X_NAVE_1 = 0.85;

const CANTIDAD_PARTICULAS_EXPLOSION = 24;
// imp-12: bastantes menos partículas y sin color de fuego -- un vistazo
// basta para distinguir "no ha hecho nada" de un impacto directo.
const CANTIDAD_PARTICULAS_EXPLOSION_SIN_DANIO = 8;

interface PuntoFraccion {
  readonly x: number;
  readonly y: number;
}

function fraccionDeVentana(clienteX: number, clienteY: number): PuntoFraccion {
  return { x: clienteX / window.innerWidth, y: clienteY / window.innerHeight };
}

// impacto-naves: solo cosmético, no toca la física. En modo espacial nave.y
// YA es el centro real del círculo de colisión (colocarNaves lo valida así) y
// se usa tal cual. En suelo plano (nave.y ausente) alturaSuperficie sigue
// devolviendo la altura de los PIES, como siempre -- pero el contenedor de
// Nave ahora nace centrado en su casco (geometriaCasco), así que sin este
// desplazamiento de RADIO_CASCO_NAVE_PX la nave se dibujaría hundida hasta la
// mitad en el terreno. window.__debug.naves NO aplica este ajuste: sigue
// reportando la misma altura que usa avanzar() para la colisión real.
function alturaRenderNave(naveY: number | undefined, alturaDerivada: number): number {
  return naveY ?? alturaDerivada - RADIO_CASCO_NAVE_PX;
}

// Escena real del juego (render-juego). El gesto de apuntado se resuelve
// SOLO a partir de la fracción del viewport que ocupa cada punto -- nunca de
// pointer.x/y de Phaser ni del tamaño del lienzo -- para que sea invariante
// al letterbox de Phaser.Scale.FIT (necesario para render-4) exactamente
// igual que lo era bajo el RESIZE de andamiaje-1: la fracción de ventana no
// sabe que el lienzo existe.
export class Partida extends Phaser.Scene {
  private estado!: EstadoPartida;
  private terreno!: ReturnType<typeof crearTerrenoPhaser>["terreno"];
  private rival: Personalidad = RIVAL_POR_DEFECTO;
  // ia-5: distancia real del último disparo de la máquina contra el
  // jugador, para que decidirTurnoIA corrija el siguiente intento -- se iba
  // a null a propósito en crearFuenteIA (ver fuente.ts) porque esa función
  // no ve el resultado de su propio disparo; aquí sí se ve, un turno
  // después, así que este campo es el puente entre los dos.
  private ultimoIntentoIA: UltimoIntentoIA | null = null;
  // partida-3/hallazgo: a la distancia real entre naves, el único arco
  // viable suele ser casi vertical, donde el 0.35x de un solo fallo (ia-5)
  // no basta para que la máquina converja -- se cuentan los fallos seguidos
  // contra ESTE objetivo para que decidirTurnoIA componga la corrección
  // (0.35^n) en vez de repetir la misma que ya ha demostrado que no alcanza.
  // NUNCA se resetea a 0 con un acierto puntual (partida-3, segundo
  // hallazgo): un disparo que cae cerca por pura suerte del ruido, antes de
  // que la corrección haya convergido de verdad, no demuestra que ya no
  // haga falta corregir -- resetear ahí descartaba toda la racha aprendida y
  // la máquina volvía a fallar gordo el turno siguiente, en un vaivén que no
  // converge nunca. Solo crece; ya no hace daño quedarse "de más" precisa.
  private fallosConsecutivosIA = 0;
  private datosEscena: DatosEscenaPartida = {};
  private naves!: [Nave, Nave];
  private indicadorDeriva!: IndicadorDeriva;
  private animador!: AnimadorProyectil;
  // humor-6: instancia SEPARADA del animador real -- reproduce el último
  // vuelo de nuevo sin tocar this.estado ni this.naves, así que un jugador
  // puede pedir la repetición sin que eso cuente como un turno.
  private animadorRepeticion!: AnimadorProyectil;
  private ultimoVueloParaRepetir: {
    readonly inicial: EstadoProyectil;
    readonly gravedad: number;
    readonly deriva: number;
    readonly detenerse: (p: EstadoProyectil) => boolean;
    readonly planetas?: RegistroPlanetas;
  } | null = null;
  private selectorFrases!: SelectorFrases;
  // Estadísticas reales por nave (humor-7): se acumulan turno a turno, nunca
  // se recalculan a posteriori, para que el parte de guerra final describa
  // exactamente lo que pasó y no una aproximación.
  private estadisticas!: [EstadisticasPartida, EstadisticasPartida];
  private emisorExplosion!: Phaser.GameObjects.Particles.ParticleEmitter;
  // imp-12: un impacto sin daño necesita distinguirse a simple vista de uno
  // que sí daña -- mismo evento "impacto", pero un fogonazo aparte (menos
  // partículas, gris humo en vez de naranja) en vez de reutilizar el mismo
  // emisor con el mismo aspecto para los dos casos.
  private emisorExplosionSinDanio!: Phaser.GameObjects.Particles.ParticleEmitter;
  private cancelarManejadorDisparo: (() => void) | null = null;
  private cancelarManejadorRepeticion: (() => void) | null = null;

  private readonly manejarPointerDown = (evento: PointerEvent): void => this.alPointerDown(evento);

  constructor() {
    super("Partida");
  }

  // Recibida de game.scene.add(key, Partida, true, datos) en main.ts. El
  // parámetro de URL ?mapa= sigue teniendo la última palabra sobre
  // datosEscena.mapaId: lo usan los tests e2e de bloques anteriores a
  // partida-completa (render-6, control-1...) que navegan directo con un
  // mapa concreto sin pasar por la pantalla de inicio.
  init(data: DatosEscenaPartida = {}): void {
    this.datosEscena = data;
  }

  create(): void {
    window.__debug = window.__debug ?? {};
    // "Otra partida" reutiliza los mismos stores de módulo (singletons, no
    // ligados al ciclo de vida de React) para una escena de Phaser
    // completamente nueva: sin esto arrastrarían el ajuste, el arma agotada,
    // la reacción y la medalla de la partida ya terminada.
    reiniciarControl();
    limpiarReaccion();
    limpiarParteDeGuerra();
    reiniciarResultadoTurno();
    this.ultimoIntentoIA = null;
    this.fallosConsecutivosIA = 0;

    const parametrosUrl = new URLSearchParams(window.location.search);
    const idMapa = parametrosUrl.get("mapa") ?? this.datosEscena.mapaId;
    this.rival = this.datosEscena.personalidadId ? buscarPersonalidad(this.datosEscena.personalidadId) : RIVAL_POR_DEFECTO;

    if (idMapa) {
      // Modo de suelo plano de siempre (atajo ?mapa=, tests e2e de bloques
      // anteriores a render-espacio).
      fijarModoEspacial(false);
      window.__debug.modoEspacial = false;

      const mapa = buscarMapa(idMapa);
      window.__debug.mapa = {
        id: mapa.id,
        semillaTerreno: mapa.semillaTerreno,
        gravedad: mapa.mundo.gravedad,
        etiquetaDeriva: mapa.mundo.etiquetaDeriva,
      };

      const mascara = generarMascara(mapa.semillaTerreno, MUNDO_ANCHO, MUNDO_ALTO);
      const xNave0 = Math.round(MUNDO_ANCHO * FRACCION_X_NAVE_0);
      const xNave1 = Math.round(MUNDO_ANCHO * FRACCION_X_NAVE_1);
      this.estado = crearPartidaInicial(mapa.mundo, mascara, xNave0, xNave1, mapa.semillaPartida);

      const { terreno } = crearTerrenoPhaser(this, mascara, "terreno-partida", mapa.paleta);
      this.terreno = terreno;
      this.selectorFrases = crearSelectorFrases(mapa.semillaPartida);
    } else {
      // Hito jugable render-espacio: sistema planetario generado, naves
      // flotando entre planetas (colocacion-naves) -- sin la comodidad de
      // crearPartidaInicial (solo sabe de xNave0/xNave1 en suelo plano), el
      // EstadoPartida se ensambla a mano con lo que ya trae colocarNaves.
      fijarModoEspacial(true);
      window.__debug.modoEspacial = true;

      const semillaSistema = this.datosEscena.semillaSistema ?? SEMILLA_SISTEMA_POR_DEFECTO;
      // Sin gravedad ni deriva ambiental: en el vacío, lo único que tira de
      // un proyectil es la gravedad de los planetas (simularVuelo, grav-*)
      // -- una deriva uniforme aquí no representa nada físico, a diferencia
      // del "viento" narrativo de los mapas de suelo plano.
      const mundoEspacial: ParametrosMundo = {
        ancho: MUNDO_ANCHO,
        alto: MUNDO_ALTO,
        gravedad: 0,
        deriva: 0,
        etiquetaDeriva: "Vacío: aquí no empuja nada que no sea un planeta",
      };
      window.__debug.mapa = {
        id: `sistema-${semillaSistema}`,
        semillaTerreno: semillaSistema,
        gravedad: mundoEspacial.gravedad,
        etiquetaDeriva: mundoEspacial.etiquetaDeriva,
      };

      // impacto-naves (imp-9): colocarNaves puede regenerar el sistema si
      // ninguna disposición sobre el original resulta viable con casco real
      // -- el `sistema` que se renderiza tiene que ser el mismo que el que
      // colocarNaves acabó usando de verdad, nunca uno generado aparte.
      const colocacion = colocarNaves(semillaSistema, mundoEspacial, crearEstadoAleatorio(semillaSistema));
      const sistema = colocacion.sistema;
      this.estado = {
        version: 1,
        mundo: mundoEspacial,
        mascara: sistema.mascara,
        naves: colocacion.naves,
        turno: 0,
        numeroTurno: 0,
        aleatorio: colocacion.aleatorio,
        resultado: { tipo: "en-curso" },
        planetas: sistema.planetas,
      };

      const { terreno } = crearTerrenoEspacioPhaser(this, sistema.mascara, "terreno-partida", sistema.planetas);
      this.terreno = terreno;
      // esp-3: se hornea una sola vez aquí, en create() -- ninguna otra
      // ruta de este fichero vuelve a llamar a crearFondoEspacial, así que
      // window.__debug.fondoEspacial.bakes se queda en 1 para siempre.
      crearFondoEspacial(this, semillaSistema, MUNDO_ANCHO, MUNDO_ALTO, "fondo-espacial");
      window.__debug.fondoEspacial = { bakes: 1 };
      this.selectorFrases = crearSelectorFrases(semillaSistema);
    }

    const texturaCanvas = this.textures.get("terreno-partida") as Phaser.Textures.CanvasTexture;
    exponerDepuracionDeTerreno(this.terreno, texturaCanvas);
    window.__debug.terreno!.listo = true;

    // Universal desde colocacion-naves (nav-1): con nave.y presente (modo
    // espacial) se usa tal cual -- no hay ninguna columna de terreno bajo
    // una nave flotando de la que derivar su altura -- y con nave.y ausente
    // (suelo plano de siempre) se sigue derivando en vivo con
    // alturaSuperficie, exactamente como antes de este bloque.
    const [nave0, nave1] = this.estado.naves;
    const y0 = alturaRenderNave(nave0.y, alturaSuperficie(this.estado.mascara, nave0.x) ?? MUNDO_ALTO - 1);
    const y1 = alturaRenderNave(nave1.y, alturaSuperficie(this.estado.mascara, nave1.x) ?? MUNDO_ALTO - 1);
    this.naves = [new Nave(this, 0, nave0.x, y0, true, 45), new Nave(this, 1, nave1.x, y1, false, 135)];

    this.indicadorDeriva = new IndicadorDeriva(this, 90, 40);
    this.refrescarIndicadorDeriva();

    this.animador = new AnimadorProyectil(this);
    this.animadorRepeticion = new AnimadorProyectil(this);
    this.estadisticas = [estadisticasIniciales(), estadisticasIniciales()];

    const lienzoParticula = this.make.graphics({ x: 0, y: 0 });
    lienzoParticula.fillStyle(0xffcc66, 1);
    lienzoParticula.fillCircle(3, 3, 3);
    lienzoParticula.generateTexture("particula-explosion", 6, 6);
    lienzoParticula.destroy();
    this.emisorExplosion = this.add.particles(0, 0, "particula-explosion", {
      lifespan: 400,
      speed: { min: 40, max: 180 },
      scale: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
    });

    // imp-12: mismo procedimiento que la explosión con daño, pero gris humo
    // y más pequeña -- un fogonazo apagado en vez de una detonación.
    const lienzoParticulaSinDanio = this.make.graphics({ x: 0, y: 0 });
    lienzoParticulaSinDanio.fillStyle(0x8a8a8a, 1);
    lienzoParticulaSinDanio.fillCircle(2, 2, 2);
    lienzoParticulaSinDanio.generateTexture("particula-explosion-sin-danio", 4, 4);
    lienzoParticulaSinDanio.destroy();
    this.emisorExplosionSinDanio = this.add.particles(0, 0, "particula-explosion-sin-danio", {
      lifespan: 250,
      speed: { min: 15, max: 60 },
      scale: { start: 0.6, end: 0 },
      quantity: 0,
      emitting: false,
    });

    window.addEventListener("pointerdown", this.manejarPointerDown);
    this.cancelarManejadorDisparo = registrarManejadorDisparo((entrada) => this.dispararEntrada(entrada, true));
    this.cancelarManejadorRepeticion = registrarManejadorRepeticion(() => this.reproducirRepeticion());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.limpiarEntrada());

    // humor-5: Phaser ya pausa/reanuda su bucle solo al cambiar de pestaña
    // (game.loop.pause/resume con suavizado de delta) -- aquí solo hace falta
    // engancharse a esos mismos eventos para que el audio no siga sonando ni
    // consumiendo el AudioContext en segundo plano.
    this.game.events.on(Phaser.Core.Events.PAUSE, pausarAudio);
    this.game.events.on(Phaser.Core.Events.RESUME, reanudarAudio);

    this.game.renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => {
      // render-5: los recursos WebGL (incluida la CanvasTexture del
      // terreno) se pierden con el contexto -- hay que repintar desde la
      // máscara ACTUAL, nunca desde la textura original.
      this.terreno.repintarCompleta();
      window.__debug.webgl = { restauraciones: (window.__debug.webgl?.restauraciones ?? 0) + 1 };
    });

    window.__debug.jugarTurnosGuionizados = (numero) => this.jugarTurnosGuionizados(numero);
    window.__debug.forzarFinDePartida = () => this.forzarFinDePartida();
    window.__debug.solucionBalisticaJugador = () => this.calcularSolucionBalistica(this.estado);
    window.__debug.estadoAudio = () => estadoAudioActual();
    window.__debug.reproducirRepeticion = () => this.reproducirRepeticion();
    window.__debug.repeticionEnCurso = false;
    window.__debug.impactoRepeticion = null;
    window.__debug.parteDeGuerra = null;
    window.__debug.ultimosEventos = [];
    window.__debug.dispararReaccionHumor = (tipo) => this.reaccionarAHumor([crearEventoDePruebaHumor(tipo)]);
    window.__debug.forzarProyectilPerdido = () =>
      this.aplicarResultadoTurno(this.estado, [{ tipo: "proyectil-perdido", nave: this.estado.turno }]);
    this.refrescarDebugNaves();

    // render-4: la cámara nunca se mueve ni hace zoom en este bloque (no hay
    // persecución de disparo todavía), así que el rectángulo de mundo
    // visible es constante desde el primer fotograma -- se calcula una vez.
    // this.cameras.main.worldView todavía no está poblado en el primer
    // fotograma (Phaser lo calcula en el preRender de la cámara, que aún no
    // ha corrido dentro de create()) -- da {0,0,0,0} en vez del rectángulo
    // real. La cámara no se mueve ni hace zoom en este bloque, así que el
    // mundo visible es exactamente el tamaño de juego fijo (this.scale.width
    // / height, el mismo MUNDO_ANCHO x MUNDO_ALTO que usa la conversión de
    // gesto a coordenada de mundo), sin necesidad de esperar a ese primer
    // preRender.
    window.__debug.camara = { x: 0, y: 0, ancho: this.scale.width, alto: this.scale.height };
    window.__debug.turno = this.estado.turno;
    window.__debug.numeroTurno = this.estado.numeroTurno;
    publicarJugable(this.puedeJugarAhora());
  }

  update(_time: number, delta: number): void {
    this.animador.actualizar(delta);
    this.animadorRepeticion.actualizar(delta);
    window.__debug!.animacionEnCurso = this.animador.enVuelo();
    window.__debug!.repeticionEnCurso = this.animadorRepeticion.enVuelo();

    // humor-1: la cámara sacude durante la reacción a un evento de humor --
    // hay que refrescar el rectángulo visible cada fotograma mientras dura
    // esa sacudida, no solo una vez en create() (ver el comentario allí sobre
    // por qué el primer fotograma no sirve).
    const vista = this.cameras.main.worldView;
    if (vista.width > 0 && vista.height > 0) {
      window.__debug!.camara = { x: vista.x, y: vista.y, ancho: vista.width, alto: vista.height };
    }
    window.__debug!.sacudiendoCamara = this.cameras.main.shakeEffect.isRunning;

    publicarJugable(this.puedeJugarAhora());
  }

  private puedeJugarAhora(): boolean {
    return (
      this.estado.resultado.tipo !== "terminada" &&
      this.estado.turno === ID_JUGADOR &&
      !this.animador.enVuelo() &&
      !this.animadorRepeticion.enVuelo()
    );
  }

  private limpiarEntrada(): void {
    window.removeEventListener("pointerdown", this.manejarPointerDown);
    this.cancelarManejadorDisparo?.();
    this.cancelarManejadorDisparo = null;
    this.cancelarManejadorRepeticion?.();
    this.cancelarManejadorRepeticion = null;
    this.game.events.off(Phaser.Core.Events.PAUSE, pausarAudio);
    this.game.events.off(Phaser.Core.Events.RESUME, reanudarAudio);
  }

  private alPointerDown(evento: PointerEvent): void {
    // humor-4: desbloquearAudio() solo puede llamarse dentro de un gesto real
    // del usuario. La pantalla de inicio (partida-completa) ya lo hace en el
    // clic de "Jugar", así que en la práctica el AudioContext suele existir
    // ya al llegar aquí -- este listener de "pointerdown" en window se deja
    // como red de seguridad (llamar dos veces es barato, ver desbloquearAudio)
    // para cualquier entrada que llegue a esta escena sin haber pasado por
    // ese botón (navegación directa de los tests e2e de bloques anteriores).
    desbloquearAudio();

    const fraccion = fraccionDeVentana(evento.clientX, evento.clientY);

    // andamiaje-1: todo toque publica el punto de mundo, arrastre o no --
    // conversión por estiramiento independiente en X/Y (no por zoom
    // uniforme), la única que hace que la misma fracción de viewport
    // produzca la misma coordenada de mundo con cualquier proporción de
    // pantalla. El gesto de apuntado en sí (ganancia, arrastre) vive fuera
    // del lienzo (ControlHUD/juego/control): no necesita saber dónde está
    // el terreno, así que aquí solo queda este punto de depuración.
    window.__debug!.ultimoPunto = { x: fraccion.x * MUNDO_ANCHO, y: fraccion.y * MUNDO_ALTO };
  }

  // Resuelve el disparo YA (avanzar es puro y síncrono) y anima el vuelo con
  // la misma integración exacta -- el punto donde la animación deja de
  // moverse coincide con el impacto real porque es literalmente el mismo
  // cálculo, no una aproximación (ver AnimadorProyectil). esJugador
  // distingue el disparo que hay que recordar como "último disparo del
  // jugador" (control-5) del disparo automático de la máquina.
  private dispararEntrada(entrada: EntradaDeTurno, esJugador: boolean): void {
    const estadoAntes = this.estado;
    if (estadoAntes.resultado.tipo === "terminada" || this.animador.enVuelo()) {
      return;
    }

    const tirador: IdNave = estadoAntes.turno;
    const naveTiradora = estadoAntes.naves[tirador];
    const origenX = naveTiradora.x;
    const origenY = naveTiradora.y ?? alturaSuperficie(estadoAntes.mascara, origenX) ?? estadoAntes.mundo.alto - 1;

    const { estado: estadoDespues, eventos } = avanzar(estadoAntes, entrada);

    const eventoImpacto = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> => evento.tipo === "impacto");

    // ia-5: se mide AQUÍ (jugarTurno/avanzar ya ha resuelto el disparo real
    // de la máquina), no dentro de crearFuenteIA -- esa fuente no puede ver
    // el resultado de su propio tiro (ver fuente.ts). Se guarda para el
    // siguiente turno de la máquina, cuando el objetivo sigue siendo el
    // jugador (el único emparejamiento posible en esta partida real).
    if (!esJugador) {
      const objetivoId = naveContraria(tirador);
      const objetivoX = estadoAntes.naves[objetivoId].x;
      const puntoDeCaida = eventoImpacto ?? { x: origenX, y: origenY };
      const distancia = Math.abs(puntoDeCaida.x - objetivoX);
      if (distancia > UMBRAL_FALLO_PX) this.fallosConsecutivosIA += 1;
      this.ultimoIntentoIA = { distanciaAlObjetivoPx: distancia, fallosConsecutivos: this.fallosConsecutivosIA };
    }

    window.__debug!.ultimoDisparo = {
      anguloGrados: entrada.anguloGrados,
      potencia: entrada.potencia,
      impacto: eventoImpacto ? { x: eventoImpacto.x, y: eventoImpacto.y } : { x: origenX, y: origenY },
    };
    if (esJugador) {
      publicarDisparoJugadorResuelto({ anguloGrados: entrada.anguloGrados, potencia: entrada.potencia, armaId: entrada.arma });
    }
    publicarJugable(false);

    const rad = (entrada.anguloGrados * Math.PI) / 180;
    const v = velocidadDesdePotencia(entrada.potencia);
    const inicial: EstadoProyectil = crearProyectil(origenX, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
    const detenerse = detenerseEnSuelo(estadoAntes.mascara, estadoAntes.mundo.ancho, estadoAntes.mundo.alto);

    // humor-6: se guarda de CUALQUIER disparo (jugador o IA) el mismo objeto
    // `inicial` que se le pasa al animador real -- integrarPasoProyectil
    // devuelve estados nuevos en cada paso (nunca muta el que recibe), así
    // que esta referencia sigue intacta cuando se pida la repetición.
    this.ultimoVueloParaRepetir = {
      inicial,
      gravedad: estadoAntes.mundo.gravedad,
      deriva: estadoAntes.mundo.deriva,
      detenerse,
      planetas: estadoAntes.planetas,
    };

    this.animador.iniciar(
      inicial,
      estadoAntes.mundo.gravedad,
      estadoAntes.mundo.deriva,
      detenerse,
      (final) => {
      // humor-6: el punto donde la animación se detiene DE VERDAD puede no
      // coincidir píxel a píxel con eventoImpacto (la máscara que ve el
      // cliente ya lleva el cráter de este disparo tallado antes de que la
      // animación arranque) -- se guarda aparte para que la repetición se
      // compare contra lo que de verdad se vio, no contra el valor teórico.
      window.__debug!.ultimoDisparo = { ...window.__debug!.ultimoDisparo!, impactoReal: { x: final.x, y: final.y } };
      this.aplicarResultadoTurno(estadoDespues, eventos);
      // Encadenar aquí (y no dentro de aplicarResultadoTurno) es lo que
      // evita que jugarTurnosGuionizados/forzarFinDePartida -- que también
      // llaman a aplicarResultadoTurno, pero con su propio guion de
      // fuentes -- disparen un turno extra no contado por su bucle.
      if (this.estado.resultado.tipo !== "terminada" && this.estado.turno !== ID_JUGADOR) {
        this.dispararTurnoIA();
      }
      },
      estadoAntes.planetas,
    );
  }

  // Tras resolver un disparo del jugador, si la partida sigue y el turno es
  // de la máquina, la máquina dispara sola -- así control-1 comprueba el
  // circuito completo (elegir, apuntar, disparar, responder) sin que el
  // bloque siguiente (partida-completa) tenga que reconstruir este enganche.
  private dispararTurnoIA(): void {
    const { entrada, estado } = crearFuenteIA(this.rival, this.ultimoIntentoIA)(this.estado);
    this.estado = estado;
    this.dispararEntrada(entrada, false);
  }

  private aplicarResultadoTurno(estadoDespues: EstadoPartida, eventos: readonly EventoSimulacion[]): void {
    // estadoAntes es this.estado ANTES de reasignarlo más abajo -- se captura
    // aquí (y no en cada llamador) para que jugarTurnosGuionizados y
    // forzarFinDePartida, que también pasan por esta función con su propio
    // guion, acumulen estadísticas y disparen reacciones igual que un disparo
    // real del jugador o de la IA.
    const estadoAntes = this.estado;
    const tirador = estadoAntes.turno;
    this.actualizarEstadisticas(tirador, estadoAntes, estadoDespues, eventos);
    window.__debug!.ultimosEventos = eventos;

    this.terreno.sincronizarDesde(estadoDespues.mascara);

    for (const evento of eventos) {
      if (evento.tipo === "impacto") {
        if (evento.danio > 0) {
          this.emisorExplosion.explode(CANTIDAD_PARTICULAS_EXPLOSION, evento.x, evento.y);
          window.__debug!.ultimoTipoExplosion = "danio";
        } else {
          this.emisorExplosionSinDanio.explode(CANTIDAD_PARTICULAS_EXPLOSION_SIN_DANIO, evento.x, evento.y);
          window.__debug!.ultimoTipoExplosion = "sin-danio";
        }
      }
    }
    this.reaccionarAHumor(eventos);
    publicarResultadoTurno(resumenTurno(eventos));

    this.estado = estadoDespues;
    this.refrescarNaves();
    this.refrescarDebugNaves();
    window.__debug!.turno = this.estado.turno;
    window.__debug!.numeroTurno = this.estado.numeroTurno;
    publicarJugable(this.puedeJugarAhora());

    if (estadoDespues.resultado.tipo === "terminada") {
      const estadisticasGanador = this.estadisticas[estadoDespues.resultado.ganador];
      const parte = generarParteDeGuerra(estadisticasGanador);
      publicarParteDeGuerra(parte, estadisticasGanador);
      window.__debug!.parteDeGuerra = { ...parte, estadisticas: estadisticasGanador };
      // partida-5: intento de guardado best-effort -- si localStorage no
      // está disponible, guardarUltimaPartida se degrada en silencio (ver
      // progreso.ts) y la partida ya jugada no se pierde por eso.
      guardarUltimaPartida(parte, estadisticasGanador);
    }
  }

  // humor-7: disparos, fallos, autoimpactos, daño hecho y píxeles de mundo
  // destruidos, atribuidos SIEMPRE a quien tenía el turno en este avanzar()
  // -- nunca recalculados del estado final, que ya no distingue quién hizo
  // qué.
  private actualizarEstadisticas(
    tirador: IdNave,
    estadoAntes: EstadoPartida,
    estadoDespues: EstadoPartida,
    eventos: readonly EventoSimulacion[],
  ): void {
    const previas = this.estadisticas[tirador];
    const fallo = eventos.some((evento) => evento.tipo === "arma-falla");
    const autoimpacto = eventos.some((evento) => evento.tipo === "autoimpacto");
    // El impacto sobre uno mismo (autoimpacto) también emite su propio
    // evento "impacto" con objetivo === tirador (ver avanzar.ts): excluirlo
    // aquí es lo que evita contar el autodaño como daño al enemigo.
    const danioAlEnemigo = eventos.reduce(
      (total, evento) => (evento.tipo === "impacto" && evento.objetivo !== tirador ? total + evento.danio : total),
      0,
    );
    const pixelesDestruidos = contarPixelesDestruidos(estadoAntes.mascara, estadoDespues.mascara);

    this.estadisticas[tirador] = {
      disparos: previas.disparos + 1,
      fallos: previas.fallos + (fallo ? 1 : 0),
      autoimpactos: previas.autoimpactos + (autoimpacto ? 1 : 0),
      danioHechoAlEnemigo: previas.danioHechoAlEnemigo + danioAlEnemigo,
      pixelesDestruidos: previas.pixelesDestruidos + pixelesDestruidos,
    };
  }

  // humor-1, humor-2: sacudida de cámara, tono y frase contextual para cada
  // evento de humor del turno -- la voz que narra es siempre la del rival
  // elegido (this.rival), también cuando el evento le ha pasado al jugador,
  // porque solo hay un rival por partida.
  private reaccionarAHumor(eventos: readonly EventoSimulacion[]): void {
    for (const evento of eventos) {
      if (!esEventoHumor(evento)) continue;
      this.cameras.main.shake(DURACION_SACUDIDA_MS, INTENSIDAD_SACUDIDA);
      const frase = this.selectorFrases.elegir(this.rival.id, evento.tipo);
      publicarReaccion(frase, evento.tipo);
      reproducirTono(evento.tipo);
    }
  }

  // humor-6: reproduce el ÚLTIMO vuelo real (de cualquiera de las dos naves)
  // con una instancia de animador completamente aparte -- no toca
  // this.estado, this.naves ni el terreno, así que pedir una repetición no
  // cuenta como jugar un turno ni puede desincronizar la partida.
  private reproducirRepeticion(): void {
    if (!this.ultimoVueloParaRepetir || this.animadorRepeticion.enVuelo()) {
      return;
    }
    const { inicial, gravedad, deriva, detenerse, planetas } = this.ultimoVueloParaRepetir;
    window.__debug!.impactoRepeticion = null;
    this.animadorRepeticion.iniciar(
      inicial,
      gravedad,
      deriva,
      detenerse,
      (final) => {
        window.__debug!.impactoRepeticion = { x: final.x, y: final.y };
      },
      planetas,
    );
  }

  private refrescarNaves(): void {
    for (const [indice, naveEstado] of this.estado.naves.entries()) {
      const y = alturaRenderNave(
        naveEstado.y,
        alturaSuperficie(this.estado.mascara, naveEstado.x) ?? this.estado.mundo.alto - 1,
      );
      this.naves[indice].posicionarEn(naveEstado.x, y);
      this.naves[indice].actualizarIntegridad(naveEstado.integridad);
    }
  }

  private refrescarDebugNaves(): void {
    window.__debug!.naves = this.estado.naves.map((nave, indice) => ({
      id: indice as 0 | 1,
      x: nave.x,
      y: nave.y ?? alturaSuperficie(this.estado.mascara, nave.x) ?? this.estado.mundo.alto - 1,
      integridad: nave.integridad,
    }));
  }

  private refrescarIndicadorDeriva(): void {
    const dibujado = this.indicadorDeriva.actualizar(this.estado.mundo.deriva, this.estado.mundo.etiquetaDeriva);
    window.__debug!.deriva = dibujado;
  }

  // render-2, render-5: juega N turnos reales con la misma avanzar() que un
  // jugador, sin animación -- el test no depende de esperar fotogramas, solo
  // del estado ya resuelto.
  private jugarTurnosGuionizados(numero: number): void {
    const fuentes: readonly [ReturnType<typeof crearFuenteIA>, ReturnType<typeof crearFuenteIA>] = [
      crearFuenteIA(LA_CONTABLE),
      crearFuenteIA(ALMIRANTE_BISAGRA),
    ];

    for (let i = 0; i < numero; i++) {
      if (this.estado.resultado.tipo === "terminada") {
        break;
      }
      const { estado, eventos } = jugarTurno(this.estado, fuentes);
      this.aplicarResultadoTurno(estado, eventos);
    }
  }

  // Solución balística exacta (deriva 0) para que quien tiene el turno
  // acierte al rival -- la misma fórmula que usa el intento inicial de la
  // capa de IA. Solo es exacta si el mapa tiene deriva 0 (ver
  // resolverSolucionesBalisticas); con deriva no nula sigue siendo la mejor
  // aproximación disponible sin física real de más.
  private calcularSolucionBalistica(estado: EstadoPartida): { anguloGrados: number; potencia: number } | null {
    const tirador = estado.turno;
    const objetivoId = naveContraria(tirador);
    const naveTiradora = estado.naves[tirador];
    const naveObjetivo = estado.naves[objetivoId];
    const origenX = naveTiradora.x;
    const objetivoX = naveObjetivo.x;
    const origenSuperficie = naveTiradora.y ?? alturaSuperficie(estado.mascara, origenX) ?? estado.mundo.alto - 1;
    const objetivoSuperficie = naveObjetivo.y ?? alturaSuperficie(estado.mascara, objetivoX) ?? estado.mundo.alto - 1;
    const origenCanonY = origenSuperficie - ALTURA_CANON_PX;

    const soluciones = resolverSolucionesBalisticas(origenX, origenCanonY, objetivoX, objetivoSuperficie, estado.mundo.gravedad);
    return soluciones[0] ?? null;
  }

  // Solo para forzar la captura de "fin de partida" de render-7: el
  // enfrentamiento de personalidades de jugarTurnosGuionizados no sirve para
  // esto porque La Contable contra Almirante Bisagra no converge (ver
  // desviaciones), así que aquí se apunta con la solución balística exacta y
  // se dispara Despedida, cuyo autodaño garantizado (fiabilidad 1) acota el
  // número de turnos con independencia de si el impacto acierta al rival.
  private forzarFinDePartida(): void {
    for (let i = 0; i < TOPE_TURNOS_DESENLACE; i++) {
      if (this.estado.resultado.tipo === "terminada") break;

      const solucion = this.calcularSolucionBalistica(this.estado) ?? { anguloGrados: 45, potencia: 70 };
      const { estado, eventos } = avanzar(this.estado, {
        arma: ARMA_DESENLACE,
        anguloGrados: solucion.anguloGrados,
        potencia: solucion.potencia,
      });
      this.aplicarResultadoTurno(estado, eventos);
    }
  }
}
