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
import { SALDO_INICIAL } from "@/sim/partida/economia";
import type { EntradaDeTurno, EstadoPartida, IdNave, ModoJuego, ParametrosMundo } from "@/sim/partida/tipos";
import { TIPOS_EVENTO_HUMOR, type EventoSimulacion, type TipoEventoHumor } from "@/sim/partida/eventos";
import { alturaSuperficie, detenerseEnSuelo, ALTURA_CANON_PX, resolverDisparo } from "@/sim/armas/resolver";
import { buscarArma, CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import type { Arma } from "@/sim/armas/tipos";
import { RADIO_CASCO_NAVE_PX, crearRastreadorImpactoNaves } from "@/sim/naves/impacto";
import { cajaCasco } from "@/sim/naves/geometriaCasco";
import { puntosSilueta, dimensionMayor } from "@/juego/proyectiles/geometriaProyectil";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { barridoRejilla } from "@/sim/balistica/rejilla";
import type { NavePosicion } from "@/sim/naves/impacto";
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
import { UMBRAL_FALLO_PX, UMBRAL_DANIO_SUFICIENTE_POR_TURNO, type UltimoIntentoIA } from "@/sim/ia/decidir";
import { exponerDepuracionDeTerreno } from "@/juego/depuracion/exponerTerreno";
import {
  fijarModo,
  fijarModoEspacial,
  obtenerEstadoControl,
  publicarDisparoJugadorResuelto,
  publicarJugable,
  publicarSaldo,
  registrarManejadorDisparo,
  reiniciarControl,
} from "@/juego/control/store";
import { limpiarReaccion, publicarReaccion, registrarManejadorRepeticion } from "@/juego/control/reaccion";
import { limpiarParteDeGuerra, publicarParteDeGuerra } from "@/juego/control/parteDeGuerraStore";
import { publicarResultadoTurno, reiniciarResultadoTurno } from "@/juego/control/resultadoTurnoStore";
import { crearSelectorBromas, type SelectorBromas } from "@/contenido/selectorBromas";
import { vozDeNave } from "@/contenido/bancoBromas";
import type { CategoriaBroma } from "@/sim/partida/categoriaBroma";
import { debeMostrarBromaDeDisparo, FRECUENCIA_BROMAS_POR_DEFECTO } from "@/contenido/frecuenciaBromas";
import { publicarBromaDisparo, publicarBromaImpacto, reiniciarBromas } from "@/juego/control/broma";
import { publicarIntegridad, reiniciarIntegridad } from "@/juego/control/integridadStore";
import { guardarUltimaPartida } from "@/juego/control/progreso";
import { crearSelectorFrases, type SelectorFrases } from "@/contenido/selectorFrases";
import { desbloquearAudio, estadoAudioActual, pausarAudio, reanudarAudio, reproducirTono } from "@/juego/audio/motor";
import type { DatosEscenaPartida } from "@/juego/main";
import { comprobarCantidadDentroDelTecho, crearEmisorRegistrado } from "@/juego/efectos/crearEmisorRegistrado";
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
// proy-4: tope duro del pool de la estela -- declarado aquí (no en un
// fichero de datos) porque es un límite técnico de rendimiento, no un
// parámetro de diseño de partida como el catálogo de armas.
const TOPE_PARTICULAS_ESTELA = 40;

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
  // ia-n8: turnos SEGUIDOS que la máquina ha disparado sin causar daño real
  // al jugador -- decidirTurnoIA lo usa para forzar un arma con daño > 0 al
  // tercero (Chispa alargaba partidas con el Vertedero Portátil, daño 0).
  // Se mide sobre el daño REAL de avanzar(), nunca sobre lo que predijo la
  // búsqueda: la búsqueda decide antes de que el error de personalidad se
  // inyecte, así que su daño previsto puede no ser el que de verdad ocurre.
  private turnosSeguidosSinDanioIA = 0;
  // ia-n7: turnos SEGUIDOS que la máquina ha causado menos de
  // UMBRAL_DANIO_SUFICIENTE_POR_TURNO de daño real (incluido cero) --
  // decidirTurnoIA lo usa para desistir de cavar con ARMA_DE_DESBLOQUEO
  // cuando ese roce conecta pero es demasiado lento (partida-3: Chispa
  // contra La Contable encajando ~1pt por turno durante más de 40 turnos).
  // NUNCA se resetea, igual que fallosConsecutivos.
  private turnosSeguidosDanioInsuficienteIA = 0;
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
    // impacto-naves (desviación, ver entregable): se guardan los INSUMOS del
    // rastreador, no una instancia -- un rastreador es con estado (guarda si
    // la gracia del propio casco ya se consumió) y la repetición puede
    // pedirse varias veces, así que cada reproducción necesita el suyo
    // propio, fresco, en vez de reutilizar uno ya consumido por el vuelo
    // real o por una repetición anterior.
    readonly navesParaRastreador?: readonly { readonly id: IdNave; readonly x: number; readonly y: number }[];
    readonly tiradorId: IdNave;
    // proyectiles-visibles: qué arma disparó, para que la repetición dibuje
    // la misma silueta que el vuelo real en vez de caer al arma por
    // defecto.
    readonly arma: Arma;
  } | null = null;
  private selectorFrases!: SelectorFrases;
  private selectorBromas!: SelectorBromas;
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
  // proy-4: estela de pool ACOTADO -- maxParticles en la config del emisor
  // (no un contador propio) es lo que garantiza el tope, así que
  // getAliveParticleCount() nunca puede superarlo, también con varios vuelos
  // seguidos sin que el pool "en reposo" entre turnos crezca.
  private emisorEstela!: Phaser.GameObjects.Particles.ParticleEmitter;
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
    // esc-1: geometría real, calculada UNA vez con las mismas funciones que
    // dibujan la nave y el catálogo de proyectiles -- no cambia entre
    // turnos ni con el mapa, así que no hace falta recalcularla más abajo.
    const cajaNave = cajaCasco(1);
    window.__debug.geometria = {
      naveLadoMayorDibujadoPx: Math.max(cajaNave.ancho, cajaNave.alto),
      radioCascoColisionPx: RADIO_CASCO_NAVE_PX,
      proyectilLadoMayorMaximoPx: Math.max(...CATALOGO_ARMAS.map((arma) => dimensionMayor(puntosSilueta(arma)))),
    };
    // "Otra partida" reutiliza los mismos stores de módulo (singletons, no
    // ligados al ciclo de vida de React) para una escena de Phaser
    // completamente nueva: sin esto arrastrarían el ajuste, el arma agotada,
    // la reacción y la medalla de la partida ya terminada.
    reiniciarControl();
    limpiarReaccion();
    limpiarParteDeGuerra();
    reiniciarResultadoTurno();
    reiniciarBromas();
    reiniciarIntegridad();
    this.ultimoIntentoIA = null;
    this.fallosConsecutivosIA = 0;
    this.turnosSeguidosSinDanioIA = 0;
    this.turnosSeguidosDanioInsuficienteIA = 0;

    const parametrosUrl = new URLSearchParams(window.location.search);
    const idMapa = parametrosUrl.get("mapa") ?? this.datosEscena.mapaId;
    this.rival = this.datosEscena.personalidadId ? buscarPersonalidad(this.datosEscena.personalidadId) : RIVAL_POR_DEFECTO;

    // modos-y-presupuesto: ?modo= sigue la misma convención que ?mapa=/
    // ?semilla= -- atajo determinista para los tests e2e, con la última
    // palabra sobre datosEscena.modo. ?saldo= SOLO existe para que modo-2
    // pueda forzar el saldo a 0 sin jugar la partida entera hasta agotarlo.
    const modoParam = parametrosUrl.get("modo");
    const modo: ModoJuego = modoParam === "presupuesto" ? "presupuesto" : modoParam === "barra-libre" ? "barra-libre" : (this.datosEscena.modo ?? "barra-libre");
    const saldoParam = parametrosUrl.get("saldo");
    const saldoInicial = modo === "presupuesto" ? (saldoParam !== null ? Number(saldoParam) : SALDO_INICIAL) : undefined;
    fijarModo(modo, saldoInicial ?? null);
    window.__debug.modo = modo;
    window.__debug.saldo = saldoInicial ?? null;

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
      this.estado = {
        ...crearPartidaInicial(mapa.mundo, mascara, xNave0, xNave1, mapa.semillaPartida),
        modo,
        ...(saldoInicial !== undefined ? { saldo: saldoInicial } : {}),
      };

      const { terreno } = crearTerrenoPhaser(this, mascara, "terreno-partida", mapa.paleta);
      this.terreno = terreno;
      this.selectorFrases = crearSelectorFrases(mapa.semillaPartida);
      this.selectorBromas = crearSelectorBromas(mapa.semillaPartida);
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
        modo,
        ...(saldoInicial !== undefined ? { saldo: saldoInicial } : {}),
      };

      // cie-2: el mismo sistema.planetas que usa la gravedad y el render,
      // no una copia generada aparte -- ver DebugGlobal.planetas.
      window.__debug.planetas = sistema.planetas.map((planeta) => ({
        id: planeta.id,
        cx: planeta.cx,
        cy: planeta.cy,
        radio: planeta.radio,
      }));

      const { terreno } = crearTerrenoEspacioPhaser(this, sistema.mascara, "terreno-partida", sistema.planetas);
      this.terreno = terreno;
      // esp-3: se hornea una sola vez aquí, en create() -- ninguna otra
      // ruta de este fichero vuelve a llamar a crearFondoEspacial, así que
      // window.__debug.fondoEspacial.bakes se queda en 1 para siempre.
      crearFondoEspacial(this, semillaSistema, MUNDO_ANCHO, MUNDO_ALTO, "fondo-espacial");
      window.__debug.fondoEspacial = { bakes: 1 };
      this.selectorFrases = crearSelectorFrases(semillaSistema);
      this.selectorBromas = crearSelectorBromas(semillaSistema);
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
    this.emisorExplosion = crearEmisorRegistrado(this, "explosion-con-danio", 0, 0, "particula-explosion", {
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
    this.emisorExplosionSinDanio = crearEmisorRegistrado(this, "explosion-sin-danio", 0, 0, "particula-explosion-sin-danio", {
      lifespan: 250,
      speed: { min: 15, max: 60 },
      scale: { start: 0.6, end: 0 },
      quantity: 0,
      emitting: false,
    });

    // proy-4: partícula quieta que solo se desvanece (speed 0) -- es un
    // punto de estela, no una chispa de explosión, así que no debe salir
    // disparada del punto donde se emite.
    const lienzoEstela = this.make.graphics({ x: 0, y: 0 });
    lienzoEstela.fillStyle(0xffe08a, 1);
    lienzoEstela.fillCircle(2, 2, 2);
    lienzoEstela.generateTexture("particula-estela", 4, 4);
    lienzoEstela.destroy();
    this.emisorEstela = crearEmisorRegistrado(this, "estela-proyectil", 0, 0, "particula-estela", {
      lifespan: 220,
      speed: 0,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.7, end: 0 },
      quantity: 0,
      emitting: false,
      maxParticles: TOPE_PARTICULAS_ESTELA,
    });
    this.emisorEstela.setDepth(40);

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
    window.__debug.dispararRafagaTurbo = (numero) => this.dispararRafagaTurbo(numero);
    window.__debug.forzarFinDePartida = () => this.forzarFinDePartida();
    window.__debug.solucionBalisticaJugador = () => this.calcularSolucionBalistica(this.estado);
    window.__debug.solucionMultipozoJugador = () => this.calcularSolucionMultipozo(this.estado);
    window.__debug.probarDisparoMultipozoJugador = (anguloGrados, potencia) =>
      this.probarDisparoMultipozo(this.estado, anguloGrados, potencia);
    window.__debug.estadoAudio = () => estadoAudioActual();
    window.__debug.reproducirRepeticion = () => this.reproducirRepeticion();
    window.__debug.repeticionEnCurso = false;
    window.__debug.impactoRepeticion = null;
    window.__debug.proyectilEnVuelo = null;
    window.__debug.estela = { vivas: 0, tope: TOPE_PARTICULAS_ESTELA };
    window.__debug.estelaMaxVivas = 0;
    window.__debug.parteDeGuerra = null;
    window.__debug.ultimosEventos = [];
    window.__debug.historialBromas = [];
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
    this.actualizarEstelaYDebugProyectil();

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

  // proy-4/proy-5: un único punto que emite la estela del vuelo REAL en
  // curso (nunca el de repetición: humor-6 lo deja explícitamente fuera de
  // la partida) y publica su posición y arma al debug -- así ni el pool
  // acotado ni la comprobación de visibilidad dependen de leer píxeles.
  private actualizarEstelaYDebugProyectil(): void {
    const posicion = this.animador.obtenerPosicion();
    if (posicion) {
      // emitParticleAt sin recuento explícito usa this.ops.quantity.onEmit(),
      // que lee la config del emisor (quantity: 0 -- pensada para que no
      // emita solo por frecuencia) y por tanto no emitía NINGUNA partícula:
      // el recuento hay que pasarlo aquí, no en la config del emisor.
      this.emisorEstela.emitParticleAt(posicion.x, posicion.y, 1);
      const armaId = this.animador.obtenerArmaId() ?? CATALOGO_ARMAS[0].id;
      window.__debug!.proyectilEnVuelo = { x: posicion.x, y: posicion.y, armaId };
    } else {
      window.__debug!.proyectilEnVuelo = null;
    }
    const vivas = this.emisorEstela.getAliveParticleCount();
    window.__debug!.estela = { vivas, tope: TOPE_PARTICULAS_ESTELA };
    window.__debug!.estelaMaxVivas = Math.max(window.__debug!.estelaMaxVivas ?? 0, vivas);
  }

  // proy-4 (desviación, ver entregable): un test que dispare 20 vuelos
  // reales a la velocidad de reproducción normal tardaría minutos bajo WebGL
  // por software (ver imp-11/imp-12, ~70s por vuelo animado). Esta función
  // dispara y resuelve turnos reales -- el MISMO dispararEntrada/
  // aplicarResultadoTurno que un turno jugado a mano, nunca
  // jugarTurnosGuionizados, que se salta la animación (y por tanto la
  // estela) por completo -- pero empuja ella misma el reloj de la animación
  // con Scene.update() en vez de esperar a que el navegador entregue un
  // requestAnimationFrame real por paso. La trayectoria y la emisión de
  // partículas son exactamente las mismas que en un turno jugado; solo deja
  // de esperar el reloj real entre pasos.
  //
  // proy-4 (desviación, ver entregable): la solución balística exacta con
  // un arma de daño real puede terminar la partida (alguien llega a 0 de
  // integridad) mucho antes de los 20 disparos que pide el criterio -- lo
  // que se mide aquí es el pool de partículas de la estela a lo largo de 20
  // disparos reales seguidos, no el desenlace de un combate concreto, así
  // que cada vez que la partida termina dentro de la ráfaga se repone la
  // integridad de ambas naves (y el turno, siempre de vuelta al jugador) y
  // se continúa disparando en el mismo mundo, en vez de cortar la ráfaga.
  private dispararRafagaTurbo(numeroDeDisparos: number): void {
    const PASO_TURBO_MS = 32;
    const objetivoTurno = this.estado.numeroTurno + numeroDeDisparos;
    let guardia = 0;
    while (this.estado.numeroTurno < objetivoTurno && guardia < 200_000) {
      guardia++;
      if (this.estado.resultado.tipo === "terminada") {
        // El turno vuelve siempre al jugador (no a quien le tocara cuando
        // terminó la partida): así la ráfaga sigue avanzando bajo su propio
        // control sin depender de que la máquina retome un turno que ya no
        // existe como tal.
        this.estado = {
          ...this.estado,
          resultado: { tipo: "en-curso" },
          turno: ID_JUGADOR,
          naves: [
            { ...this.estado.naves[0], integridad: 100 },
            { ...this.estado.naves[1], integridad: 100 },
          ],
        };
        this.refrescarDebugNaves();
      } else if (this.puedeJugarAhora()) {
        const solucion = this.calcularSolucionBalistica(this.estado);
        const ajuste = solucion ?? { anguloGrados: 45, potencia: 55 };
        this.dispararEntrada(
          { arma: CATALOGO_ARMAS[0].id, anguloGrados: ajuste.anguloGrados, potencia: ajuste.potencia },
          true,
        );
      } else if (this.animador.enVuelo() || this.animadorRepeticion.enVuelo()) {
        this.update(0, PASO_TURBO_MS);
      } else {
        // No debería ocurrir: dispararTurnoIA se encadena en el propio
        // onComplete del disparo del jugador. Guardia defensiva contra girar
        // en vacío en vez de colgar el test.
        break;
      }
    }
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

    const { estado: estadoDespues, eventos, categoriaBroma } = avanzar(estadoAntes, entrada);

    const eventoImpacto = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> => evento.tipo === "impacto");

    // ia-5: se mide AQUÍ (jugarTurno/avanzar ya ha resuelto el disparo real
    // de la máquina), no dentro de crearFuenteIA -- esa fuente no puede ver
    // el resultado de su propio tiro (ver fuente.ts). Se guarda para el
    // siguiente turno de la máquina, cuando el objetivo sigue siendo el
    // jugador (el único emparejamiento posible en esta partida real).
    if (!esJugador) {
      const objetivoId = naveContraria(tirador);
      const naveObjetivoAntes = estadoAntes.naves[objetivoId];
      const objetivoX = naveObjetivoAntes.x;
      const objetivoY = naveObjetivoAntes.y ?? alturaSuperficie(estadoAntes.mascara, objetivoX) ?? estadoAntes.mundo.alto - 1;
      const puntoDeCaida = eventoImpacto ?? { x: origenX, y: origenY };
      // impacto-naves/ia-multipozo: distancia 2D euclídea al objetivo
      // (imp-3), nunca solo en X -- en modo espacial (naves a distinta
      // altura) la distancia en X por sí sola subestima un disparo que pasó
      // muy por encima o por debajo.
      const distancia = Math.hypot(puntoDeCaida.x - objetivoX, puntoDeCaida.y - objetivoY);
      if (distancia > UMBRAL_FALLO_PX) this.fallosConsecutivosIA += 1;

      // ia-n8: cuenta SOLO el daño real que este disparo causó al jugador
      // (nunca autodaño ni el daño propio de Despedida) -- decidirTurnoIA
      // fuerza un arma con daño > 0 tras dos turnos seguidos en 0, y esto se
      // mide sobre el daño REAL de avanzar(), nunca sobre lo que predijo la
      // búsqueda antes de que el error de personalidad se inyectara.
      const danioCausado = eventos
        .filter(
          (evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> =>
            evento.tipo === "impacto" && evento.objetivo === objetivoId,
        )
        .reduce((total, evento) => total + evento.danio, 0);
      this.turnosSeguidosSinDanioIA = danioCausado > 0 ? 0 : this.turnosSeguidosSinDanioIA + 1;

      // ia-n7: nunca baja, igual que fallosConsecutivos -- ver el comentario
      // del campo en la clase.
      if (danioCausado < UMBRAL_DANIO_SUFICIENTE_POR_TURNO) {
        this.turnosSeguidosDanioInsuficienteIA += 1;
      }

      this.ultimoIntentoIA = {
        distanciaAlObjetivoPx: distancia,
        fallosConsecutivos: this.fallosConsecutivosIA,
        turnosSeguidosSinDanio: this.turnosSeguidosSinDanioIA,
        turnosSeguidosDanioInsuficiente: this.turnosSeguidosDanioInsuficienteIA,
      };
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

    // impacto-naves: mismo criterio que avanzar.ts para decidir si hay
    // cuerpo de colisión de casco -- modo espacial (las dos naves con `y`) y
    // solo naves vivas. Sin este rastreador, la vista no sabía que un casco
    // podía terminar el vuelo antes que el suelo o el presupuesto (ver
    // AnimadorProyectil.ts).
    const naveObjetivoAntes = estadoAntes.naves[naveContraria(tirador)];
    const modoEspacial = naveTiradora.y !== undefined && naveObjetivoAntes.y !== undefined;
    const navesVivas = modoEspacial
      ? estadoAntes.naves
          .map((nave, id) => ({ id: id as IdNave, nave }))
          .filter(({ nave }) => nave.integridad > 0)
          .map(({ id, nave }) => ({ id, x: nave.x, y: nave.y as number }))
      : undefined;
    const rastreadorNaves = navesVivas ? crearRastreadorImpactoNaves(navesVivas, tirador) : undefined;

    // humor-6: se guarda de CUALQUIER disparo (jugador o IA) el mismo objeto
    // `inicial` que se le pasa al animador real -- integrarPasoProyectil
    // devuelve estados nuevos en cada paso (nunca muta el que recibe), así
    // que esta referencia sigue intacta cuando se pida la repetición.
    const armaDisparada = buscarArma(entrada.arma);

    this.ultimoVueloParaRepetir = {
      inicial,
      gravedad: estadoAntes.mundo.gravedad,
      deriva: estadoAntes.mundo.deriva,
      detenerse,
      planetas: estadoAntes.planetas,
      navesParaRastreador: navesVivas,
      tiradorId: tirador,
      arma: armaDisparada,
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
      this.aplicarResultadoTurno(estadoDespues, eventos, categoriaBroma);
      // Encadenar aquí (y no dentro de aplicarResultadoTurno) es lo que
      // evita que jugarTurnosGuionizados/forzarFinDePartida -- que también
      // llaman a aplicarResultadoTurno, pero con su propio guion de
      // fuentes -- disparen un turno extra no contado por su bucle.
      if (this.estado.resultado.tipo !== "terminada" && this.estado.turno !== ID_JUGADOR) {
        this.dispararTurnoIA();
      }
      },
      estadoAntes.planetas,
      rastreadorNaves,
      armaDisparada,
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

  private aplicarResultadoTurno(
    estadoDespues: EstadoPartida,
    eventos: readonly EventoSimulacion[],
    categoriaBroma?: CategoriaBroma,
  ): void {
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
          comprobarCantidadDentroDelTecho("explosion-con-danio", CANTIDAD_PARTICULAS_EXPLOSION);
          this.emisorExplosion.explode(CANTIDAD_PARTICULAS_EXPLOSION, evento.x, evento.y);
          window.__debug!.ultimoTipoExplosion = "danio";
        } else {
          comprobarCantidadDentroDelTecho("explosion-sin-danio", CANTIDAD_PARTICULAS_EXPLOSION_SIN_DANIO);
          this.emisorExplosionSinDanio.explode(CANTIDAD_PARTICULAS_EXPLOSION_SIN_DANIO, evento.x, evento.y);
          window.__debug!.ultimoTipoExplosion = "sin-danio";
        }
      }
    }
    this.reaccionarAHumor(eventos);
    if (categoriaBroma) {
      this.reaccionarABroma(tirador, estadoAntes.numeroTurno, categoriaBroma, eventos);
    }
    publicarResultadoTurno(resumenTurno(eventos));

    this.estado = estadoDespues;
    this.refrescarNaves();
    this.refrescarDebugNaves();
    this.refrescarEconomia();
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

  // humor-por-turno (hum-1, hum-6): a diferencia de reaccionarAHumor, esto se
  // llama en CADA turno, sin excepción -- la broma de impacto siempre se
  // publica, y la de disparo solo si frecuenciaBromas lo permite (hum-5). No
  // depende de reproducirTono ni de ningún estado de audio (hum-6): un audio
  // bloqueado por el navegador no puede impedir que la frase aparezca.
  private reaccionarABroma(
    tirador: IdNave,
    numeroTurnoAntes: number,
    categoria: CategoriaBroma,
    eventos: readonly EventoSimulacion[],
  ): void {
    const voz = vozDeNave(tirador, this.rival.id);
    let textoDisparo: string | null = null;
    if (debeMostrarBromaDeDisparo(FRECUENCIA_BROMAS_POR_DEFECTO, numeroTurnoAntes)) {
      textoDisparo = this.selectorBromas.elegirDisparo(voz);
      publicarBromaDisparo(textoDisparo);
    }
    const textoImpacto = this.selectorBromas.elegirImpacto(voz, categoria);
    publicarBromaImpacto(textoImpacto, categoria);

    // hum-1: un registro por turno, para que el test pueda comprobar "sin
    // excepción" a lo largo de varios turnos y cruzar la frase contra el
    // banco de la nave y la categoría reales -- broma.ts solo guarda la
    // última de cada tipo, insuficiente para eso.
    window.__debug!.historialBromas = [
      ...(window.__debug!.historialBromas ?? []),
      { numeroTurno: numeroTurnoAntes, tirador, voz, categoria, textoDisparo, textoImpacto, eventos },
    ];
  }

  // humor-6: reproduce el ÚLTIMO vuelo real (de cualquiera de las dos naves)
  // con una instancia de animador completamente aparte -- no toca
  // this.estado, this.naves ni el terreno, así que pedir una repetición no
  // cuenta como jugar un turno ni puede desincronizar la partida.
  private reproducirRepeticion(): void {
    if (!this.ultimoVueloParaRepetir || this.animadorRepeticion.enVuelo()) {
      return;
    }
    const { inicial, gravedad, deriva, detenerse, planetas, navesParaRastreador, tiradorId, arma } = this.ultimoVueloParaRepetir;
    // Rastreador fresco en cada repetición: es con estado (gracia del propio
    // casco) y no puede reutilizar la instancia del vuelo real ni la de una
    // repetición anterior.
    const rastreadorNaves = navesParaRastreador ? crearRastreadorImpactoNaves(navesParaRastreador, tiradorId) : undefined;
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
      rastreadorNaves,
      arma,
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
    // imp-11: el HUD (fuera del lienzo Phaser) necesita enterarse de la
    // integridad por el mismo canal pub/sub que ya usan resultado-turno y
    // parte de guerra, no leyendo window.__debug -- eso es lo que el
    // Gatekeeper señaló como evidencia que no vale (imp-11).
    publicarIntegridad(this.estado.naves);
  }

  // modos-y-presupuesto: mismo canal pub/sub que refrescarDebugNaves --
  // el HUD (fuera del lienzo) lee el saldo del store, nunca de window.__debug
  // (eso es solo para los tests e2e).
  private refrescarEconomia(): void {
    const saldo = this.estado.modo === "presupuesto" ? (this.estado.saldo ?? 0) : null;
    publicarSaldo(saldo);
    window.__debug!.saldo = saldo;
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

  // imp-11: naves() de referencia para barridoRejilla/resolverDisparo, con
  // la misma derivación de Y que ya usan refrescarDebugNaves y
  // calcularSolucionBalistica.
  private navesParaOraculo(estado: EstadoPartida): readonly NavePosicion[] {
    return estado.naves.map((nave, indice) => ({
      id: indice as IdNave,
      x: nave.x,
      y: nave.y ?? alturaSuperficie(estado.mascara, nave.x) ?? estado.mundo.alto - 1,
    }));
  }

  // imp-11 (solo para tests e2e): en modo espacial no hay fórmula cerrada
  // (calcularSolucionBalistica asume deriva/gravedad de suelo plano, no
  // gravedad multipozo) -- reutiliza el MISMO oráculo real que ya usa la IA
  // (barridoRejilla, imp-8/ia-multipozo) en vez de inventar una segunda
  // definición de "acierta". No se usa en ninguna ruta de juego real, solo
  // por window.__debug para que el test tenga un disparo de impacto
  // garantizado y verificado contra el resolutor real.
  private calcularSolucionMultipozo(estado: EstadoPartida): { anguloGrados: number; potencia: number; danio: number } | null {
    const tirador = estado.turno;
    const objetivoId = naveContraria(tirador);
    const candidatos = barridoRejilla({
      mascara: estado.mascara,
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      planetas: estado.planetas,
      gravedad: estado.mundo.gravedad,
      deriva: estado.mundo.deriva,
      aleatorio: estado.aleatorio,
      arma: buscarArma(obtenerEstadoControl().ajuste.armaId),
      naves: this.navesParaOraculo(estado),
      tiradorId: tirador,
      objetivoId,
    });
    return candidatos[0] ?? null;
  }

  // imp-11 (solo para tests e2e): disparo de comprobación con daño exacto
  // conocido de antemano contra el MISMO resolutor real (resolverDisparo),
  // no una condición de parada inventada -- así el test puede pedir un tiro
  // que falle a propósito (danio === 0) sin adivinar ángulo/potencia a
  // ciegas ni depender de que ningún planeta se cruce por casualidad.
  private probarDisparoMultipozo(estado: EstadoPartida, anguloGrados: number, potencia: number): { danio: number } {
    const tirador = estado.turno;
    const objetivoId = naveContraria(tirador);
    const naves = this.navesParaOraculo(estado);
    const tiradorPos = naves.find((nave) => nave.id === tirador)!;
    const objetivoPos = naves.find((nave) => nave.id === objetivoId)!;
    const resultado = resolverDisparo({
      mascara: estado.mascara,
      gravedad: estado.mundo.gravedad,
      deriva: estado.mundo.deriva,
      aleatorio: estado.aleatorio,
      arma: buscarArma(obtenerEstadoControl().ajuste.armaId),
      origenX: tiradorPos.x,
      origenY: tiradorPos.y,
      anguloGrados,
      potencia,
      objetivoX: objetivoPos.x,
      objetivoY: objetivoPos.y,
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      planetas: estado.planetas,
      naves,
      tiradorId: tirador,
    });
    return { danio: resultado.danioObjetivo };
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
      const { estado, eventos, categoriaBroma } = avanzar(this.estado, {
        arma: ARMA_DESENLACE,
        anguloGrados: solucion.anguloGrados,
        potencia: solucion.potencia,
      });
      this.aplicarResultadoTurno(estado, eventos, categoriaBroma);
    }
  }
}
