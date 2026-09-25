import Phaser from "phaser";
import { MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { generarMascara } from "@/sim/terreno/generador";
import { crearTerrenoPhaser } from "@/juego/terreno/crearTerrenoPhaser";
import { crearPartidaInicial, jugarTurno } from "@/sim/partida/motor";
import { avanzar } from "@/sim/partida/avanzar";
import type { EntradaDeTurno, EstadoPartida, IdNave } from "@/sim/partida/tipos";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import { alturaSuperficie, detenerseEnSuelo, ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { naveContraria } from "@/sim/partida/tipos";
import { buscarMapa, MAPA_POR_DEFECTO, type MapaJuego } from "@/juego/mundos/mapas";
import { Nave } from "@/juego/naves/Nave";
import { IndicadorDeriva } from "@/juego/deriva/IndicadorDeriva";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { LA_CONTABLE, ALMIRANTE_BISAGRA } from "@/sim/ia/personalidades";
import { exponerDepuracionDeTerreno } from "@/juego/depuracion/exponerTerreno";
import { publicarDisparoJugadorResuelto, publicarJugable, registrarManejadorDisparo } from "@/juego/control/store";
import "@/debug/tipos";

// El jugador local es siempre la nave 0 (la de la izquierda, FRACCION_X_NAVE_0)
// y la máquina la nave 1 -- válido mientras solo haya un humano por partida
// (brief); el multijugador remoto, si llega, es decisión de otro bloque.
const ID_JUGADOR: IdNave = 0;
// Personalidad de la máquina en el bucle de disparo real: La Contable es la
// que ya usa jugarTurnosGuionizados como referencia. Elegir un rival según
// mapa/dificultad es tarea de partida-completa (desviación: aquí es fija).
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

interface PuntoFraccion {
  readonly x: number;
  readonly y: number;
}

function fraccionDeVentana(clienteX: number, clienteY: number): PuntoFraccion {
  return { x: clienteX / window.innerWidth, y: clienteY / window.innerHeight };
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
  private mapa: MapaJuego = MAPA_POR_DEFECTO;
  private naves!: [Nave, Nave];
  private indicadorDeriva!: IndicadorDeriva;
  private animador!: AnimadorProyectil;
  private emisorExplosion!: Phaser.GameObjects.Particles.ParticleEmitter;
  private cancelarManejadorDisparo: (() => void) | null = null;

  private readonly manejarPointerDown = (evento: PointerEvent): void => this.alPointerDown(evento);

  constructor() {
    super("Partida");
  }

  create(): void {
    window.__debug = window.__debug ?? {};

    const parametrosUrl = new URLSearchParams(window.location.search);
    const idMapa = parametrosUrl.get("mapa");
    this.mapa = idMapa ? buscarMapa(idMapa) : MAPA_POR_DEFECTO;

    const mascara = generarMascara(this.mapa.semillaTerreno, MUNDO_ANCHO, MUNDO_ALTO);
    const xNave0 = Math.round(MUNDO_ANCHO * FRACCION_X_NAVE_0);
    const xNave1 = Math.round(MUNDO_ANCHO * FRACCION_X_NAVE_1);
    this.estado = crearPartidaInicial(this.mapa.mundo, mascara, xNave0, xNave1, this.mapa.semillaPartida);

    const { terreno } = crearTerrenoPhaser(this, mascara, "terreno-partida", this.mapa.paleta);
    this.terreno = terreno;
    const texturaCanvas = this.textures.get("terreno-partida") as Phaser.Textures.CanvasTexture;
    exponerDepuracionDeTerreno(terreno, texturaCanvas);
    window.__debug.terreno!.listo = true;

    const y0 = alturaSuperficie(mascara, xNave0) ?? MUNDO_ALTO - 1;
    const y1 = alturaSuperficie(mascara, xNave1) ?? MUNDO_ALTO - 1;
    this.naves = [new Nave(this, 0, xNave0, y0, true, 45), new Nave(this, 1, xNave1, y1, false, 135)];

    this.indicadorDeriva = new IndicadorDeriva(this, 90, 40);
    this.refrescarIndicadorDeriva();

    this.animador = new AnimadorProyectil(this);

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

    window.addEventListener("pointerdown", this.manejarPointerDown);
    this.cancelarManejadorDisparo = registrarManejadorDisparo((entrada) => this.dispararEntrada(entrada, true));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.limpiarEntrada());

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
    window.__debug!.animacionEnCurso = this.animador.enVuelo();
    publicarJugable(this.puedeJugarAhora());
  }

  private puedeJugarAhora(): boolean {
    return this.estado.resultado.tipo !== "terminada" && this.estado.turno === ID_JUGADOR && !this.animador.enVuelo();
  }

  private limpiarEntrada(): void {
    window.removeEventListener("pointerdown", this.manejarPointerDown);
    this.cancelarManejadorDisparo?.();
    this.cancelarManejadorDisparo = null;
  }

  private alPointerDown(evento: PointerEvent): void {
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
    const origenX = estadoAntes.naves[tirador].x;
    const origenY = alturaSuperficie(estadoAntes.mascara, origenX) ?? estadoAntes.mundo.alto - 1;

    const { estado: estadoDespues, eventos } = avanzar(estadoAntes, entrada);

    const eventoImpacto = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> => evento.tipo === "impacto");
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

    this.animador.iniciar(inicial, estadoAntes.mundo.gravedad, estadoAntes.mundo.deriva, detenerse, () => {
      this.aplicarResultadoTurno(estadoDespues, eventos);
      // Encadenar aquí (y no dentro de aplicarResultadoTurno) es lo que
      // evita que jugarTurnosGuionizados/forzarFinDePartida -- que también
      // llaman a aplicarResultadoTurno, pero con su propio guion de
      // fuentes -- disparen un turno extra no contado por su bucle.
      if (this.estado.resultado.tipo !== "terminada" && this.estado.turno !== ID_JUGADOR) {
        this.dispararTurnoIA();
      }
    });
  }

  // Tras resolver un disparo del jugador, si la partida sigue y el turno es
  // de la máquina, la máquina dispara sola -- así control-1 comprueba el
  // circuito completo (elegir, apuntar, disparar, responder) sin que el
  // bloque siguiente (partida-completa) tenga que reconstruir este enganche.
  private dispararTurnoIA(): void {
    const { entrada, estado } = crearFuenteIA(RIVAL_POR_DEFECTO)(this.estado);
    this.estado = estado;
    this.dispararEntrada(entrada, false);
  }

  private aplicarResultadoTurno(estadoDespues: EstadoPartida, eventos: readonly EventoSimulacion[]): void {
    this.terreno.sincronizarDesde(estadoDespues.mascara);

    for (const evento of eventos) {
      if (evento.tipo === "impacto") {
        this.emisorExplosion.explode(CANTIDAD_PARTICULAS_EXPLOSION, evento.x, evento.y);
      }
    }

    this.estado = estadoDespues;
    this.refrescarNaves();
    this.refrescarDebugNaves();
    window.__debug!.turno = this.estado.turno;
    window.__debug!.numeroTurno = this.estado.numeroTurno;
    publicarJugable(this.puedeJugarAhora());
  }

  private refrescarNaves(): void {
    for (const [indice, naveEstado] of this.estado.naves.entries()) {
      const y = alturaSuperficie(this.estado.mascara, naveEstado.x) ?? this.estado.mundo.alto - 1;
      this.naves[indice].posicionarEn(naveEstado.x, y);
      this.naves[indice].actualizarIntegridad(naveEstado.integridad);
    }
  }

  private refrescarDebugNaves(): void {
    window.__debug!.naves = this.estado.naves.map((nave, indice) => ({
      id: indice as 0 | 1,
      x: nave.x,
      y: alturaSuperficie(this.estado.mascara, nave.x) ?? this.estado.mundo.alto - 1,
      integridad: nave.integridad,
    }));
  }

  private refrescarIndicadorDeriva(): void {
    const dibujado = this.indicadorDeriva.actualizar(this.mapa.mundo.deriva, this.mapa.mundo.etiquetaDeriva);
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
    const origenX = estado.naves[tirador].x;
    const objetivoX = estado.naves[objetivoId].x;
    const origenSuperficie = alturaSuperficie(estado.mascara, origenX) ?? estado.mundo.alto - 1;
    const objetivoSuperficie = alturaSuperficie(estado.mascara, objetivoX) ?? estado.mundo.alto - 1;
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
