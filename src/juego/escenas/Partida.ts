import Phaser from "phaser";
import { MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { generarMascara } from "@/sim/terreno/generador";
import { crearTerrenoPhaser } from "@/juego/terreno/crearTerrenoPhaser";
import { crearTerrenoEspacioPhaser } from "@/juego/terreno/crearTerrenoEspacioPhaser";
import { crearFondoEspacial, rehornearFondoEspacial } from "@/juego/fondo/FondoEspacial";
import { firmaDeHalos } from "@/juego/fondo/PozosGravedad";
import { aceleracionPozo } from "@/sim/gravedad/halos";
import { masaPlaneta, type RegistroPlanetas } from "@/sim/gravedad/planetas";
import { colocarNaves } from "@/sim/naves/colocacion";
import { factorPlanetasParaArea } from "@/sim/sistema/generador";
import { crearEstadoAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { crearPartidaInicial, jugarTurno } from "@/sim/partida/motor";
import { avanzar } from "@/sim/partida/avanzar";
import { PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { costeArma } from "@/sim/partida/economia";
import { direccionDeNave } from "@/sim/naves/contacto";
import { idsNavesVivas, type EntradaDeTurno, type EstadoPartida, type IdNave, type ModoJuego, type ParametrosMundo } from "@/sim/partida/tipos";
import { TIPOS_EVENTO_HUMOR, type EventoSimulacion, type TipoEventoHumor } from "@/sim/partida/eventos";
import { alturaSuperficie, detenerseEnSuelo, ALTURA_CANON_PX, resolverDisparo } from "@/sim/armas/resolver";
import { buscarArma, CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import type { Arma } from "@/sim/armas/tipos";
import { crearRastreadorImpactoNaves } from "@/sim/naves/impacto";
import { RADIO_ENVOLVENTE_NAVE_PX, SEMIALTO_MAXIMO_NAVE_PX, cajaCasco } from "@/sim/naves/geometriaCasco";
import { puntosSilueta, dimensionMayor } from "@/juego/proyectiles/geometriaProyectil";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { barridoRejilla, RANGO_ANGULOS_ORACULO } from "@/sim/balistica/rejilla";
import type { NavePosicion } from "@/sim/naves/impacto";
import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { contarPixelesDestruidos } from "@/sim/terreno/estadisticas";
import { estadisticasIniciales, generarParteDeGuerra, type EstadisticasPartida } from "@/sim/partida/parteDeGuerra";
import { buscarMapa, SEMILLA_SISTEMA_POR_DEFECTO } from "@/juego/mundos/mapas";
import { Nave } from "@/juego/naves/Nave";
import { IndicadorDeriva } from "@/juego/deriva/IndicadorDeriva";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { buscarEquipo, esIdEquipo } from "@/sim/equipo/catalogo";
import { alcancePropulsores, volarConPropulsores } from "@/sim/equipo/propulsores";
import { LA_CONTABLE, ALMIRANTE_BISAGRA, buscarPersonalidad } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import { UMBRAL_FALLO_PX, UMBRAL_DANIO_SUFICIENTE_POR_TURNO } from "@/sim/ia/decidir";
import { exponerDepuracionDeTerreno } from "@/juego/depuracion/exponerTerreno";
import { MedidorFrames } from "@/juego/rendimiento/medidorFrames";
import { MedidorRespuesta } from "@/juego/rendimiento/medidorRespuesta";
import { ClienteSim } from "@/juego/motor/clienteSim";
import { crearTrabajadorSim } from "@/juego/motor/crearTrabajador";
import { mostrarApuntandoIA, ocultarApuntandoIA } from "@/juego/hud/indicadorApuntandoIA";
import { montarHudRendimiento } from "@/juego/rendimiento/hudRendimiento";
import {
  fijarModo,
  fijarModoEspacial,
  obtenerEstadoControl,
  publicarDisparoJugadorResuelto,
  publicarJugable,
  publicarNombreRival,
  publicarEconomia,
  publicarTurno,
  publicarPreparando,
  fijarApuntadoDirecto,
  publicarEscudoPropio,
  registrarManejadorDisparo,
  reiniciarControl,
  seleccionarArma,
} from "@/juego/control/store";
import { anguloDesdeDedo, potenciaDesdeDistancia } from "@/juego/control/apuntado";
import { limpiarReaccion, publicarReaccion, registrarManejadorRepeticion } from "@/juego/control/reaccion";
import { limpiarParteDeGuerra, publicarParteDeGuerra } from "@/juego/control/parteDeGuerraStore";
import { publicarResultadoTurno, reiniciarResultadoTurno } from "@/juego/control/resultadoTurnoStore";
import { crearSelectorBromas, type SelectorBromas } from "@/contenido/selectorBromas";
import { vozDeNave } from "@/contenido/bancoBromas";
import {
  memoriaIAInicial,
  nombreDeNave,
  sanearNombre,
  type Controlador,
  type JugadorConfig,
  type MemoriaIA,
} from "@/juego/jugadores";
import { contarHumanos, etiquetaMinirobot } from "@/juego/textosPartida";
import { publicarGanador, publicarParticipantes, reiniciarParticipantes } from "@/juego/control/participantesStore";
import type { CategoriaBroma } from "@/sim/partida/categoriaBroma";
import { debeMostrarBromaDeDisparo, FRECUENCIA_BROMAS_POR_DEFECTO } from "@/contenido/frecuenciaBromas";
import { colorDeAsiento } from "@/juego/naves/paletaNaves";
import { inyectarHistorico, obtenerBromas, publicarBromaDisparo, publicarBromaImpacto, reiniciarBromas } from "@/juego/control/broma";
import { cerrarRelevo, publicarRelevo, registrarManejadorRelevo, reiniciarRelevo } from "@/juego/control/relevoStore";
import { publicarFantasmas } from "@/juego/control/fantasmasStore";
import { publicarObjetos } from "@/juego/control/objetosStore";
import { publicarRobots } from "@/juego/control/robotsStore";
import { dibujarObjetoEvento } from "@/juego/efectos/dibujarObjetoEvento";
import { RONDAS_DE_VIDA_OBJETO, rutaPrevistaObjeto } from "@/sim/universo/objetos";
import { publicarCartel, publicarMuerteSubita, publicarPronostico, reiniciarUniverso } from "@/juego/control/universoStore";
import { buscarEvento } from "@/sim/universo/catalogoEventos";
import { conUniverso } from "@/sim/universo/efectos";
import { conMuerteSubita, drenajeDeRonda, RONDA_MUERTE_SUBITA } from "@/sim/partida/muerteSubita";
import { MAX_SALTOS_ROBOT, type EstadoRobot } from "@/sim/armas/minirobot";
import { publicarIntegridad, reiniciarIntegridad } from "@/juego/control/integridadStore";
import { guardarUltimaPartida } from "@/juego/control/progreso";
import { crearSelectorFrases, type SelectorFrases } from "@/contenido/selectorFrases";
import { desbloquearAudio, estadoAudioActual, pausarAudio, reanudarAudio, reproducirEfecto, reproducirTono } from "@/juego/audio/motor";
import { indiceTic } from "@/juego/audio/cadenciaTicTac";
import type { DatosEscenaPartida } from "@/juego/main";
import { comprobarCantidadDentroDelTecho, crearEmisorRegistrado } from "@/juego/efectos/crearEmisorRegistrado";
import { ExplosionPorCapas, fasesActivasEn } from "@/juego/efectos/ExplosionPorCapas";
import { reproducirDetonaciones } from "@/juego/efectos/reproductorDetonaciones";
import type { Detonacion } from "@/sim/partida/detonaciones";
import { amplitudSacudida, DURACION_SACUDIDA_IMPACTO_MS, intensidadDestelloDanio } from "@/juego/efectos/realceImpacto";
import { esComportamientoAdherente, insumoPerturbacionErratica, pasosDeMecha } from "@/sim/fisica/comportamientoExtendido";
import { superaPresupuestoComputo, type BandaPrevisualizacion } from "@/sim/armas/previsualizacion";
import { limpiarCuentaAtras, publicarCuentaAtras } from "@/juego/control/cuentaAtrasStore";
import { ContadorAdherencia } from "@/juego/vuelo/ContadorAdherencia";
import type { DebugEfectoVisible } from "@/debug/tipos";
import "@/debug/tipos";

// cat-2: el haz del Rayo Láser se ve al menos esto antes de apagarse.
const DURACION_HAZ_MS = 450;

// desplazamiento-tras-impacto (des-3): el deslizamiento dura entre 300 y 600 ms.
const DURACION_DESLIZAMIENTO_MS = 450;
const RADIO_MARCA_FANTASMA_U = 22;
const TAMANO_TEXTO_FANTASMA_PX = 34;
const RADIO_ROBOT_U = 14;
// salida-pantalla: cuánto se queda el aviso «¡Perdido!» en pantalla.
const DURACION_AVISO_PERDIDO_MS = 1200;
const RADIO_OBJETO_U = 18;
// Un punto de cada tantos pasos en la ruta punteada: legible y barato de dibujar.
const SALTO_PUNTEADO_OBJETO = 6;

// render-espacio (esp-6): el texto del panel "resultado del turno" -- un
// mensaje propio para "proyectil perdido en órbita" (grav-6), porque ese
// turno no tiene ni impacto ni fallo que describir con el resto de casos.
function resumenTurno(eventos: readonly EventoSimulacion[]): string {
  const base = resumenBase(eventos);
  const objetos = eventos.flatMap((evento) => {
    if (evento.tipo !== "objeto-alcanza") return [];
    return evento.objeto === "corazon" ? [`¡Corazón galáctico! +${evento.cambio} de vida.`] : [`¡Tormenta solar! ${evento.cambio} de vida.`];
  });
  return [...objetos, base].join(" ");
}

function resumenBase(eventos: readonly EventoSimulacion[]): string {
  const escudoActivado = eventos.find((evento) => evento.tipo === "escudo-activado");
  if (escudoActivado) return "Escudo activado: los disparos ajenos no te harán daño durante 2 turnos tuyos.";
  const vuelo = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "propulsores" }> => evento.tipo === "propulsores");
  if (vuelo) {
    return vuelo.motivo === "alcance" ? "Propulsores: la nave llega al límite de su alcance y se queda ahí." : "Propulsores: la nave se detiene al toparse con algo.";
  }
  const bloqueo = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "escudo-bloquea" }> => evento.tipo === "escudo-bloquea");
  if (bloqueo) return "El escudo ha parado el golpe: sin daño.";
  const perdido = eventos.find((evento) => evento.tipo === "proyectil-perdido");
  if (perdido?.tipo === "proyectil-perdido" && perdido.arma !== undefined && esComportamientoAdherente(buscarArma(perdido.arma).comportamiento)) {
    return "El gancho no se agarra al vacío del borde: se pierde sin efecto. El turno pasa igual.";
  }
  if (perdido?.tipo === "proyectil-perdido" && perdido.arma !== undefined && buscarArma(perdido.arma).comportamiento.tipo === "minirobot") {
    return "¡Perdido! El minirobot se ha ido por el borde y no explota. El turno pasa igual.";
  }
  if (perdido?.tipo === "proyectil-perdido" && perdido.salida) {
    return "¡Perdido! Tu disparo ha salido de la pantalla. El turno pasa igual.";
  }
  if (perdido) {
    return "Tu disparo se ha quedado atrapado en órbita, sin caer nunca. El turno pasa igual.";
  }
  if (eventos.some((evento) => evento.tipo === "arma-falla")) {
    return "El arma ha fallado: ni huella ni daño este turno.";
  }
  const impacto = eventos.find(
    (evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> => evento.tipo === "impacto",
  );
  const detonacionRobot = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "robot-detona" }> => evento.tipo === "robot-detona");
  if (!impacto && eventos.some((evento) => evento.tipo === "robot-posado")) {
    return "El minirobot se ha agarrado al planeta: saltará hacia su objetivo al empezar tu próximo turno.";
  }
  if (!impacto && detonacionRobot) {
    return detonacionRobot.danio > 0 ? `El minirobot ha saltado encima y explota: ${detonacionRobot.danio} de daño.` : "El minirobot explota sin llegar a nadie.";
  }
  const despedida = eventos.some((evento) => evento.tipo === "desplazamiento" && evento.reserva !== "se-queda")
    ? " La nave alcanzada salió despedida."
    : "";
  if (impacto) {
    return (impacto.danio > 0 ? `Impacto directo: ${impacto.danio} de daño.` : "El disparo ha caído sin hacer daño.") + despedida;
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
// multi-setup-partida: el objetivo de un humano. Con 2 naves es "la otra",
// como siempre; con más hay que elegir y el diseño no define un control de
// "tocar para apuntar", así que se usa el rival vivo más cercano (distancia
// euclídea), el mismo criterio de proximidad que ya aplica la IA
// (fuente.ts#elegirObjetivo) -- ver desviaciones del bloque.
function objetivoMasCercano(estado: EstadoPartida, tirador: IdNave): IdNave {
  const origen = estado.naves[tirador];
  let elegido: IdNave = tirador;
  let distanciaMinima = Number.POSITIVE_INFINITY;
  for (const id of idsNavesVivas(estado)) {
    if (id === tirador) continue;
    const nave = estado.naves[id];
    const distancia = Math.hypot(nave.x - origen.x, (nave.y ?? 0) - (origen.y ?? 0));
    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
      elegido = id;
    }
  }
  return elegido;
}
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

// gravedad-visible (grav-vis-3, corrección): grosor de la mira en píxeles
// de PANTALLA, no de mundo -- ver actualizarPrevisualizacion().
const ANCHO_MIRA_CSS_PX = 3;
const ANCHO_EXTREMO_BANDA_CSS_PX = 1.5;
const COLOR_BANDA_DISPERSION = 0xffb347;
const COLOR_EXTREMO_BANDA = 0xffd9a0;

// Reparto equiespaciado en X en el modo de suelo plano: con 2 naves da
// exactamente 0.15 y 0.85 de siempre.
const FRACCION_X_PRIMERA_NAVE = 0.15;
const FRACCION_X_ULTIMA_NAVE = 0.85;

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
// desplazamiento de SEMIALTO_MAXIMO_NAVE_PX la nave se dibujaría hundida hasta la
// mitad en el terreno. window.__debug.naves NO aplica este ajuste: sigue
// reportando la misma altura que usa avanzar() para la colisión real.
function alturaRenderNave(naveY: number | undefined, alturaDerivada: number): number {
  return naveY ?? alturaDerivada - SEMIALTO_MAXIMO_NAVE_PX;
}

// Escena real del juego (render-juego). El gesto de apuntado se resuelve
// SOLO a partir de la fracción del viewport que ocupa cada punto -- nunca de
// pointer.x/y de Phaser ni del tamaño del lienzo -- para que sea invariante
// al letterbox de Phaser.Scale.FIT (necesario para render-4) exactamente
// igual que lo era bajo el RESIZE de andamiaje-1: la fracción de ventana no
// sabe que el lienzo existe.
// Se lee en cada explosión y no una vez al montar: el usuario puede activar
// el ajuste del sistema con la partida en marcha.
function prefiereMovimientoReducido(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export class Partida extends Phaser.Scene {
  private estado!: EstadoPartida;
  private semillaFondo: number | undefined;
  private firmaHalos = "";
  // Masa de nacimiento de cada pozo (multiplicador 1, planeta entero): ancla
  // de a_sup para que los halos crezcan con la gravedad y mengüen con los cráteres.
  private readonly masasReferencia = new Map<number, number>();
  private terreno!: ReturnType<typeof crearTerrenoPhaser>["terreno"];
  private rival: Personalidad = RIVAL_POR_DEFECTO;
  // multi-setup-partida: de un único rival a una memoria por cada nave de IA
  // (ia-5, ia-autodanio-3, partida-3, ia-n7, ia-n8): con 2-3 IAs en la misma
  // partida, compartir los contadores haría que los fallos de una corrijan
  // (o castiguen) la puntería de otra.
  private memoriaIA = new Map<IdNave, MemoriaIA>();
  // multi-setup-partida: quién controla cada nave (humano o IA con su
  // personalidad), paralelo a this.estado.naves.
  private controladores: readonly Controlador[] = [];
  // relevo-turno: true mientras la pantalla de relevo tapa el juego; el
  // siguiente jugador no puede apuntar ni disparar hasta que confirme.
  private relevoPendiente = false;
  // Último humano que tuvo el dispositivo: el relevo se decide contra él y
  // no contra el tirador inmediato, para que una IA entre medias no deje
  // pasar la información de un humano al siguiente sin relevo.
  private ultimoHumano: IdNave | null = null;
  private cancelarManejadorRelevo: (() => void) | null = null;
  // sonido-procedimental (snd-2): último índice de indiceTic() publicado por
  // cada cuenta atrás -- null mientras no hay ninguna activa. Comparar el
  // índice nuevo contra este valor (en vez de disparar el tic cada fotograma)
  // es lo que convierte la cadencia continua en un tic discreto, y hacerlo
  // con dos campos separados es lo que permite que mecha y mina suenen cada
  // una a su propio ritmo si llegara a haber dos cuentas atrás a la vez.
  private ultimoIndiceTicMecha: number | null = null;
  private ultimoIndiceTicMina: number | null = null;
  // arma-granada-espoleta (gra-2, solo e2e): ningún mundo jugable tiene
  // gravedad baja de sobra para que un vuelo real de la granada supere los
  // 300 pasos sin chocar antes (gra-1/gra-4 ya prueban la exactitud de esos
  // 300 pasos con gravedad de laboratorio) -- de un solo uso, para que el
  // e2e compruebe que el HUD llega a cero en el mismo fotograma que la
  // detonación sin depender de un ángulo/potencia que no existe en ningún
  // mapa real. Nunca se lee fuera de dispararEntrada, y se consume al vuelo.
  private fusibleMechaForzadoPasos: number | null = null;
  // arma-mina-adherente (min-1, solo e2e): mismo motivo y mismo patrón de
  // uso único que fusibleMechaForzadoPasos -- ningún mundo jugable tiene
  // gravedad baja de sobra para que un vuelo real supere el presupuesto sin
  // chocar antes, así que el e2e no puede comprobar "cuenta desde que se
  // pega" apuntando un ángulo/potencia real.
  private fusibleAdherenciaForzadoPasos: number | null = null;
  private datosEscena: DatosEscenaPartida = {};
  // multi-setup-partida: de tupla de 2 a lista paralela a this.estado.naves
  // (de 2 a 4) -- el tamaño ya no es parte del tipo, igual que EstadoPartida.
  private naves!: Nave[];
  // desplazamiento-tras-impacto: marcas «Estaba aquí» del turno anterior; se
  // destruyen al resolver el turno siguiente.
  private marcasFantasma: Phaser.GameObjects.GameObject[] = [];
  private marcasRobot: Phaser.GameObjects.GameObject[] = [];
  private marcasObjeto: Phaser.GameObjects.GameObject[] = [];
  private indicadorDeriva!: IndicadorDeriva;
  private animador!: AnimadorProyectil;
  // realce-impacto (rlc-1): avance de turno retrasado mientras dura la
  // sacudida de cámara, contado a mano con el mismo `delta` del bucle de
  // update() -- NUNCA this.time.delayedCall, porque dispararRafagaTurbo
  // (proy-4, proy-5, hum-1) avanza turnos con un bucle síncrono que llama a
  // this.update() a mano sin que corra el bucle real de Phaser por debajo:
  // un delayedCall ahí se quedaría pendiente para siempre.
  private avanceTurnoPendiente: { restanteMs: number; avanzar: () => void } | null = null;
  // arma-mina-adherente (min-2): cuenta atrás anclada al mundo del vuelo
  // REAL en curso -- nunca el de repetición, mismo criterio que la estela y
  // que actualizarCuentaAtrasMecha.
  private contadorAdherencia!: ContadorAdherencia;
  // humor-6: instancia SEPARADA del animador real -- reproduce el último
  // vuelo de nuevo sin tocar this.estado ni this.naves, así que un jugador
  // puede pedir la repetición sin que eso cuente como un turno.
  private animadorRepeticion!: AnimadorProyectil;
  // cat-2: de dónde sale el haz del último disparo (la boca del cañón).
  private origenUltimoDisparo: { x: number; y: number } | null = null;
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
    readonly navesParaRastreador?: readonly NavePosicion[];
    readonly tiradorId: IdNave;
    // proyectiles-visibles: qué arma disparó, para que la repetición dibuje
    // la misma silueta que el vuelo real en vez de caer al arma por
    // defecto.
    readonly arma: Arma;
    // arma-mosca (mos-3): insumo de la perturbación errática de ESTE vuelo --
    // ausente salvo que el arma disparada sea "erratico" (ver más abajo).
    readonly perturbacion?: { readonly magnitudPxS2: number; readonly aleatorio: EstadoAleatorio };
    // arma-granada-espoleta (gra-1): pasos de simulación hasta la detonación
    // de un arma "mecha" -- ausente salvo que el arma disparada sea "mecha"
    // (ver más abajo), igual que perturbacion para "erratico".
    readonly pasosHastaDetonarMecha?: number;
    // arma-mina-adherente (min-1): pasos de simulación que cuenta la mina
    // TRAS adherirse -- ausente salvo que el arma disparada sea
    // "adherente-con-mecha" (ver más abajo), igual que pasosHastaDetonarMecha.
    readonly pasosHastaDetonarTrasAdherencia?: number;
  } | null = null;
  private selectorFrases!: SelectorFrases;
  private selectorBromas!: SelectorBromas;
  // Estadísticas reales por nave (humor-7): se acumulan turno a turno, nunca
  // se recalculan a posteriori, para que el parte de guerra final describa
  // exactamente lo que pasó y no una aproximación.
  // multi-setup-partida: misma generalización que this.naves -- paralela a
  // this.estado.naves, de 2 a 4 posiciones.
  private estadisticas!: EstadisticasPartida[];
  private emisorExplosion!: Phaser.GameObjects.Particles.ParticleEmitter;
  // imp-12: un impacto sin daño necesita distinguirse a simple vista de uno
  // que sí daña -- mismo evento "impacto", pero un fogonazo aparte (menos
  // partículas, gris humo en vez de naranja) en vez de reutilizar el mismo
  // emisor con el mismo aspecto para los dos casos.
  private emisorExplosionSinDanio!: Phaser.GameObjects.Particles.ParticleEmitter;
  // explosiones-por-capas: las cinco capas (destello, onda, escombros, humo,
  // marca persistente) viven agrupadas en su propia clase -- a diferencia de
  // los tres emisores de arriba, no es un solo GameObject sino un conjunto
  // coordinado, así que no tiene sentido repetir aquí su construcción campo
  // a campo.
  private explosionPorCapas!: ExplosionPorCapas;
  // paron-explosion: medición permanente de frames, de solo lectura.
  private readonly medidorFrames = new MedidorFrames();
  private readonly medidorRespuesta = new MedidorRespuesta();
  // respuesta-200ms: la simulación pesada vive fuera del hilo principal.
  private readonly motor = new ClienteSim(crearTrabajadorSim());
  // Hay una petición al motor cuyo resultado aún no se ha aplicado: el turno no
  // es jugable y no se admite otro disparo hasta que vuelva.
  private solicitudEnCurso = false;
  private previsEnCurso = false;
  private previsClave = "";
  private previsEstadoPedido: EstadoPartida | null = null;
  private previsPendiente: { peticion: Parameters<ClienteSim["previsualizar"]>[0]; estado: EstadoPartida } | null = null;
  private previsVigente: { estado: EstadoPartida; banda: BandaPrevisualizacion; duracionMs: number } | null = null;
  // proy-4: estela de pool ACOTADO -- maxParticles en la config del emisor
  // (no un contador propio) es lo que garantiza el tope, así que
  // getAliveParticleCount() nunca puede superarlo, también con varios vuelos
  // seguidos sin que el pool "en reposo" entre turnos crezca.
  private emisorEstela!: Phaser.GameObjects.Particles.ParticleEmitter;
  // prevision-real: se dibuja en coordenadas de MUNDO (como la estela, no
  // como IndicadorDeriva, que es HUD de pantalla) -- misma convención que
  // "dibujados en el mundo y no en un recuadro" del diseño.
  private graficosPrevisualizacion!: Phaser.GameObjects.Graphics;
  private cancelarManejadorDisparo: (() => void) | null = null;
  private cancelarManejadorRepeticion: (() => void) | null = null;

  private readonly manejarPointerDown = (evento: PointerEvent): void => this.alPointerDown(evento);
  private readonly manejarPointerMove = (evento: PointerEvent): void => this.alPointerMove(evento);
  private readonly manejarPointerFin = (evento: PointerEvent): void => this.alPointerFin(evento);
  // apuntado-y-relevo: id del puntero que arrastra sobre el lienzo (null si
  // ninguno). Un segundo dedo o un arrastre que empezó en la consola no
  // mueven el apuntado.
  private punteroApuntando: number | null = null;

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
    // explosiones-por-capas (exl-1): función PURA (no lee nada de la escena
    // ni del DOM) -- el e2e la usa para preguntar "¿qué capas tocan a los X
    // ms del impacto?" sin depender de un sleep ni de la velocidad real del
    // runner (issue #151): la respuesta es la misma en un portátil rápido y
    // en el runner de CI cargado.
    window.__debug.fasesActivasExplosion = fasesActivasEn;
    // esc-1: geometría real, calculada UNA vez con las mismas funciones que
    // dibujan la nave y el catálogo de proyectiles -- no cambia entre
    // turnos ni con el mapa, así que no hace falta recalcularla más abajo.
    const cajaNave = cajaCasco(1);
    window.__debug.geometria = {
      naveLadoMayorDibujadoPx: Math.max(cajaNave.ancho, cajaNave.alto),
      radioCascoColisionPx: RADIO_ENVOLVENTE_NAVE_PX,
      proyectilLadoMayorMaximoPx: Math.max(...CATALOGO_ARMAS.map((arma) => dimensionMayor(puntosSilueta(arma)))),
    };
    // encuadre-movil: main.ts ya recalculó MUNDO_ANCHO/MUNDO_ALTO antes de
    // construir esta escena -- el e2e no tiene otra forma de comprobar qué
    // tamaño de mundo quedó activo sin este canal.
    window.__debug.mundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO };
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
    reiniciarParticipantes();
    reiniciarRelevo();
    this.relevoPendiente = false;
    this.ultimoHumano = null;
    window.__debug.eliminadas = [];
    window.__debug.ganador = undefined;
    this.memoriaIA = new Map();

    const parametrosUrl = new URLSearchParams(window.location.search);
    const idMapa = parametrosUrl.get("mapa") ?? this.datosEscena.mapaId;
    const personalidadBase = this.datosEscena.personalidadId ? buscarPersonalidad(this.datosEscena.personalidadId) : RIVAL_POR_DEFECTO;
    // multi-setup-partida: sin `jugadores` (atajo ?mapa=, tests de bloques
    // anteriores) la partida es la de siempre: un humano contra la IA elegida.
    const jugadores: readonly JugadorConfig[] = this.datosEscena.jugadores ?? [
      { nombre: "Tú", tipo: "humano" },
      { nombre: personalidadBase.nombre, tipo: "ia", personalidadId: personalidadBase.id },
    ];
    this.controladores = jugadores.map((jugador, indice) => ({
      tipo: jugador.tipo,
      nombre: sanearNombre(jugador.nombre, `Nave ${indice + 1}`),
      personalidad:
        jugador.tipo === "ia" ? (jugador.personalidadId ? buscarPersonalidad(jugador.personalidadId) : personalidadBase) : null,
    }));
    this.rival = this.controladores.find((controlador) => controlador.personalidad !== null)?.personalidad ?? personalidadBase;
    // hud-canales-1: una sola vez por partida, para el canal de estado.
    publicarNombreRival(this.rival.nombre);
    publicarParticipantes(
      this.datosEscena.jugadores
        ? this.controladores.map((controlador) => ({ nombre: controlador.nombre, esHumano: controlador.tipo === "humano" }))
        : null,
    );
    const cantidadNaves = this.controladores.length;
    window.__debug.controladores = this.controladores.map((controlador) => ({ tipo: controlador.tipo, nombre: controlador.nombre }));

    // modos-y-presupuesto: ?modo= sigue la misma convención que ?mapa=/
    // ?semilla= -- atajo determinista para los tests e2e, con la última
    // palabra sobre datosEscena.modo. ?saldo= fija el presupuesto de la ronda
    // para que un e2e pueda probar el saldo 0 sin gastarlo eligiendo armas.
    const modoParam = parametrosUrl.get("modo");
    const modo: ModoJuego = modoParam === "presupuesto" ? "presupuesto" : modoParam === "barra-libre" ? "barra-libre" : (this.datosEscena.modo ?? "barra-libre");
    const saldoParam = parametrosUrl.get("saldo");
    const saldoInicial = modo === "presupuesto" ? (saldoParam !== null ? Number(saldoParam) : PRESUPUESTO_BASE) : undefined;
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
      const xNaves = this.controladores.map((_controlador, indice) =>
        Math.round(
          MUNDO_ANCHO *
            (FRACCION_X_PRIMERA_NAVE + ((FRACCION_X_ULTIMA_NAVE - FRACCION_X_PRIMERA_NAVE) * indice) / (cantidadNaves - 1)),
        ),
      );
      // DESVIACIÓN (encuadre-movil): mapa.mundo.ancho/alto quedan congelados
      // en el valor que tenía MUNDO_ANCHO/MUNDO_ALTO cuando mapas.ts se
      // evaluó por primera vez (antes de que configurarTamanoMundo ajuste
      // el mundo al contenedor real) -- se pisan aquí con el tamaño vivo
      // para que la física no use un mundo distinto del que de verdad se
      // renderiza.
      const mundoAjustado = { ...mapa.mundo, ancho: MUNDO_ANCHO, alto: MUNDO_ALTO };
      this.estado = {
        ...crearPartidaInicial(mundoAjustado, mascara, xNaves, mapa.semillaPartida),
        modo,
        ...(saldoInicial !== undefined ? this.economiaInicial(saldoInicial) : {}),
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
        factorPlanetas: factorPlanetasParaArea(MUNDO_ANCHO, MUNDO_ALTO),
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
      const colocacion = colocarNaves(semillaSistema, mundoEspacial, crearEstadoAleatorio(semillaSistema), cantidadNaves, this.controladores.map((controlador) => controlador.tipo === "ia"));
      const sistema = colocacion.sistema;
      this.estado = {
        version: 1,
        mundo: mundoEspacial,
        mascara: sistema.mascara,
        naves: colocacion.naves,
        ordenTurno: colocacion.naves.map((_nave, id) => id),
        turno: 0,
        numeroTurno: 0,
        aleatorio: colocacion.aleatorio,
        resultado: { tipo: "en-curso" },
        planetas: sistema.planetas,
        modo,
        ...(saldoInicial !== undefined ? this.economiaInicial(saldoInicial) : {}),
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
      // fondo-y-pozos (fnd-1, fnd-2): la capa cercana del paralaje y los
      // pozos de gravedad se funden en esta misma textura (ver el porqué en
      // FondoEspacial.ts) -- `sistema.planetas` es el mismo registro que usa
      // la gravedad real, nunca una copia.
      sistema.planetas.forEach((planeta) => this.masasReferencia.set(planeta.id, masaPlaneta(planeta)));
      const fondo = crearFondoEspacial(this, semillaSistema, MUNDO_ANCHO, MUNDO_ALTO, "fondo-espacial", sistema.planetas, this.masasReferencia);
      this.semillaFondo = semillaSistema;
      this.firmaHalos = firmaDeHalos(sistema.planetas);
      window.__debug.fondoEspacial = { bakes: 1 };
      window.__debug.halos = fondo.halos;
      window.__debug.aceleracionPozo = (id, r) => {
        const pozo = this.estado.planetas?.find((planeta) => planeta.id === id);
        return pozo === undefined ? undefined : aceleracionPozo(pozo, r);
      };
      this.selectorFrases = crearSelectorFrases(semillaSistema);
      this.selectorBromas = crearSelectorBromas(semillaSistema);
    }

    const texturaCanvas = this.textures.get("terreno-partida") as Phaser.Textures.CanvasTexture;
    exponerDepuracionDeTerreno(this.terreno, texturaCanvas);
    window.__debug.terreno!.listo = true;

    // eventos-universo: activo por defecto; `eventos=0` en la URL (o la clave
    // guardada «universo:eventos» a «0», que es como el e2e lo apaga en bloque)
    // lo desactiva, y `eventos=1` fuerza encenderlo.
    reiniciarUniverso();
    if (this.eventosActivados(parametrosUrl)) this.estado = conUniverso(this.estado);
    // muerte-subita: activa por defecto; `muerte=0` en la URL o la clave
    // guardada «muerte-subita:activada» a «0» (como el e2e la apaga en bloque)
    // la desactiva, y `muerte=1` fuerza encenderla.
    if (this.muerteSubitaActivada(parametrosUrl)) this.estado = conMuerteSubita(this.estado);
    window.__debug.fijarMuerteSubita = ({ ronda, integridades }) => {
      this.estado = {
        ...conMuerteSubita(this.estado, ronda),
        ...(integridades ? { naves: this.estado.naves.map((nave, id) => ({ ...nave, integridad: integridades[id] ?? nave.integridad })) } : {}),
      };
      this.refrescarNaves();
      this.refrescarUniverso([]);
    };
    window.__debug.fijarObjetos = (objetos) => {
      const universo = this.estado.universo;
      if (universo === undefined) return;
      const vida = RONDAS_DE_VIDA_OBJETO * Math.max(1, idsNavesVivas(this.estado).length);
      this.estado = {
        ...this.estado,
        universo: { ...universo, objetos: objetos.map((objeto, id) => ({ ...objeto, id, turnosRestantes: vida })), contadorObjetos: objetos.length },
      };
      this.refrescarObjetos();
    };
    window.__debug.fijarProximoEvento = (proximo) => {
      const universo = this.estado.universo;
      if (universo === undefined) return;
      this.estado = { ...this.estado, universo: { ...universo, proximo } };
      this.refrescarUniverso([]);
    };
    this.refrescarUniverso([]);

    // Universal desde colocacion-naves (nav-1): con nave.y presente (modo
    // espacial) se usa tal cual -- no hay ninguna columna de terreno bajo
    // una nave flotando de la que derivar su altura -- y con nave.y ausente
    // (suelo plano de siempre) se sigue derivando en vivo con
    // alturaSuperficie, exactamente como antes de este bloque.
    // multi-setup-partida: las naves pares miran a +x y las impares a -x,
    // como las dos de siempre; con 3-4 el ángulo inicial es solo cosmético
    // (el control lo sustituye en cuanto le toca a un humano).
    this.naves = this.estado.naves.map((nave, id) => {
      const y = alturaRenderNave(nave.y, alturaSuperficie(this.estado.mascara, nave.x) ?? MUNDO_ALTO - 1);
      const haciaMasX = direccionDeNave(id as IdNave) === 1;
      return new Nave(this, id, nave.x, y, haciaMasX, haciaMasX ? 45 : 135);
    });

    // hud-canales-1 (quinta corrección): (180,70) en CSS px, centrado y por
    // debajo de la banda de botones fixed (historico-bromas-toggle,
    // toggle-sacudida, toggle-silenciado viven en los 54px superiores) --
    // ver el comentario de IndicadorDeriva sobre por qué (90,40) en
    // unidades de juego dejó de servir al cambiar MUNDO_ANCHO.
    this.indicadorDeriva = new IndicadorDeriva(this, 180, 70);
    this.refrescarIndicadorDeriva();

    this.animador = new AnimadorProyectil(this);
    this.animadorRepeticion = new AnimadorProyectil(this);
    this.contadorAdherencia = new ContadorAdherencia(this);
    // Depth 30: por debajo de la estela del proyectil real (40, que solo
    // existe durante el vuelo, cuando la previsualización ya está oculta),
    // por encima del terreno y las naves.
    this.graficosPrevisualizacion = this.add.graphics().setDepth(30);
    this.estadisticas = this.estado.naves.map(() => estadisticasIniciales());

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

    this.explosionPorCapas = new ExplosionPorCapas(this);

    // paron-explosion: __debug.rendimiento es una instantánea viva (getter)
    // y el HUD solo aparece con ?rendimiento=1.
    Object.defineProperty(window.__debug, "rendimiento", {
      configurable: true,
      enumerable: true,
      get: () => ({ ...this.medidorFrames.instantanea(), ...this.medidorRespuesta.instantanea() }),
    });
    Object.defineProperty(window.__debug, "motor", {
      configurable: true,
      enumerable: true,
      get: () => ({ modo: this.motor.modo, motivo: this.motor.motivoEnLinea }),
    });
    const dejarDeObservar = this.medidorFrames.observarFramesLargos();
    const dejarDeMedirRespuesta = this.medidorRespuesta.observar();
    const quitarHud = new URLSearchParams(window.location.search).get("rendimiento") === "1" ? montarHudRendimiento(this.medidorFrames, this.medidorRespuesta) : null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      dejarDeObservar();
      dejarDeMedirRespuesta();
      this.motor.terminar();
      ocultarApuntandoIA();
      quitarHud?.();
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
    window.addEventListener("pointermove", this.manejarPointerMove);
    window.addEventListener("pointerup", this.manejarPointerFin);
    window.addEventListener("pointercancel", this.manejarPointerFin);
    this.cancelarManejadorDisparo = registrarManejadorDisparo((entrada) => {
      // El store del control no sabe a quién apunta cada humano (trae un
      // objetivo fijo, válido solo con dos naves): el objetivo lo decide
      // la escena, que es quien ve a todas las naves vivas.
      const completa = { ...entrada, objetivoId: this.objetivoDe(this.estado.turno) };
      if (completa.accion !== undefined && completa.accion !== "disparo") this.usarEquipoEntrada(completa, true);
      else this.dispararEntrada(completa, true);
    });
    this.cancelarManejadorRepeticion = registrarManejadorRepeticion(() => this.reproducirRepeticion());
    this.cancelarManejadorRelevo = registrarManejadorRelevo(() => this.confirmarRelevoActual());
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
    window.__debug.inyectarHistorico = inyectarHistorico;
    window.__debug.dispararReaccionHumor = (tipo) => this.reaccionarAHumor([crearEventoDePruebaHumor(tipo)]);
    window.__debug.forzarProyectilPerdido = () =>
      this.aplicarResultadoTurno(this.estado, [{ tipo: "proyectil-perdido", nave: this.estado.turno }]);
    // arma-granada-espoleta (gra-2, solo e2e): ver el comentario del campo
    // fusibleMechaForzadoPasos -- se consume en el disparo siguiente, sea el
    // que sea.
    window.__debug.forzarFusibleMechaPasos = (pasos) => {
      this.fusibleMechaForzadoPasos = pasos;
    };
    // arma-mina-adherente (min-1, solo e2e): ver el comentario del campo
    // fusibleAdherenciaForzadoPasos -- se consume en el disparo siguiente,
    // sea el que sea.
    window.__debug.forzarFusibleAdherenciaPasos = (pasos) => {
      this.fusibleAdherenciaForzadoPasos = pasos;
    };
    window.__debug.dispararEventoImpactoReal = (nave, x, y, danio = 0) => {
      this.manejarEventosVisuales([{ tipo: "impacto", x, y, objetivo: nave, danio, impactoNave: nave }], []);
    };
    // nve-1, nve-3: fuerza la integridad de una nave sin jugar el turno real
    // que la produciría -- aterrizar a mano en los tres tramos de daño no es
    // reproducible con un disparo balístico exacto. Muta this.estado.naves
    // directamente (no this.estado entero) porque no hay un turno que
    // resolver: solo el refresco visual y de depuración que un turno real
    // dispara al final.
    window.__debug.forzarIntegridad = (nave, integridad) => {
      const acotada = Math.max(0, Math.min(100, integridad));
      this.estado = {
        ...this.estado,
        naves: this.estado.naves.map((actual, id) => (id === nave ? { ...actual, integridad: acotada } : actual)),
      };
      this.refrescarNaves();
      this.refrescarDebugNaves();
    };
    // adrian-angulo-360: teletransporta una nave (solo tiene efecto con
    // nave.y presente, el hito espacial) sin jugar un turno real -- mismo
    // patrón que forzarIntegridad. Necesario para que el e2e pueda colocar
    // al rival justo debajo del tirador de forma determinista.
    window.__debug.forzarPosicionNave = (nave, x, y) => {
      this.estado = {
        ...this.estado,
        naves: this.estado.naves.map((actual, id) => (id === nave ? { ...actual, x, y } : actual)),
      };
      this.refrescarNaves();
      this.refrescarDebugNaves();
    };
    // arte-siluetas-3: sin este refrescarNaves() de arranque, marcarActiva()
    // no se llamaba nunca hasta que se resolvía el primer turno (línea más
    // abajo, dentro de aplicarResultadoTurno) -- el indicador de nave propia
    // se quedaba oculto para las dos naves durante todo el apuntado inicial,
    // que es justo el momento en que más hace falta.
    this.refrescarNaves();
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
    publicarTurno(this.estado.turno);
    window.__debug.numeroTurno = this.estado.numeroTurno;
    this.refrescarEconomia();
    this.refrescarRobots();
    this.refrescarObjetos();
    publicarJugable(this.puedeJugarAhora());
    publicarPreparando(false);
  }

  update(_time: number, delta: number): void {
    this.medidorFrames.registrarFrame(delta);
    this.animador.actualizar(delta);
    this.animadorRepeticion.actualizar(delta);
    window.__debug!.animacionEnCurso = this.animador.enVuelo();
    window.__debug!.repeticionEnCurso = this.animadorRepeticion.enVuelo();
    this.actualizarEstelaYDebugProyectil();
    this.actualizarCuentaAtrasMecha();
    this.actualizarCuentaAtrasAdherencia();

    // humor-1: la cámara sacude durante la reacción a un evento de humor --
    // hay que refrescar el rectángulo visible cada fotograma mientras dura
    // esa sacudida, no solo una vez en create() (ver el comentario allí sobre
    // por qué el primer fotograma no sirve).
    const vista = this.cameras.main.worldView;
    if (vista.width > 0 && vista.height > 0) {
      window.__debug!.camara = { x: vista.x, y: vista.y, ancho: vista.width, alto: vista.height };
    }
    window.__debug!.sacudiendoCamara = this.cameras.main.shakeEffect.isRunning;

    // realce-impacto (rlc-1): mismo delta que mueve animador/animadorRepeticion
    // arriba -- así el avance de turno retrasado resuelve igual en el bucle
    // real de Phaser que dentro de dispararRafagaTurbo (ver el comentario de
    // avanceTurnoPendiente).
    if (this.avanceTurnoPendiente) {
      this.avanceTurnoPendiente.restanteMs -= delta;
      if (this.avanceTurnoPendiente.restanteMs <= 0) {
        const avanzar = this.avanceTurnoPendiente.avanzar;
        this.avanceTurnoPendiente = null;
        avanzar();
      }
    }

    const jugable = this.puedeJugarAhora();
    publicarJugable(jugable);


    this.actualizarPrevisualizacion(jugable);
    // paron-explosion: la subida del terreno a la GPU, una vez por frame y
    // después de lanzar las explosiones del frame (el destello va primero).
    this.terreno.vaciarCola();
  }

  // prevision-real (pvr-1, pvr-2, pvr-3): recalcula y redibuja la mira cada
  // fotograma mientras se puede jugar -- el mismo gate `jugable` que ya usa
  // el núcleo realzado (con-4) es, literalmente, "turno del jugador sin
  // animación en curso", así que la previsualización se oculta sola durante
  // el vuelo real o el turno rival sin ningún caso especial aparte (pvr-2).
  private actualizarPrevisualizacion(jugable: boolean): void {
    this.graficosPrevisualizacion.clear();

    if (!jugable) {
      window.__debug!.previsualizacion = null;
      return;
    }

    const estado = this.estado;
    const tirador = estado.turno;
    const naveTiradora = estado.naves[tirador];
    const naveObjetivo = estado.naves[this.objetivoDe(tirador)];
    const origenX = naveTiradora.x;
    const origenY = naveTiradora.y ?? alturaSuperficie(estado.mascara, origenX) ?? estado.mundo.alto - 1;
    const { anguloGrados, potencia, armaId } = obtenerEstadoControl().ajuste;
    if (obtenerEstadoControl().equipoId === "propulsores" && naveTiradora.y !== undefined) {
      this.dibujarPrevisualizacionPropulsores(estado, anguloGrados, potencia);
      return;
    }
    window.__debug!.previsualizacionPropulsores = null;

    // impacto-naves: mismo criterio que dispararEntrada -- el casco solo
    // existe como cuerpo de colisión en modo espacial, con naves vivas.
    const modoEspacial = naveTiradora.y !== undefined && naveObjetivo.y !== undefined;
    const navesVivas = modoEspacial
      ? estado.naves
          .map((nave, id) => ({ id: id as IdNave, nave }))
          .filter(({ nave }) => nave.integridad > 0)
          .map(({ id, nave }) => ({ id, x: nave.x, y: nave.y as number, integridad: nave.integridad }))
      : undefined;
    // respuesta-200ms: la mira se calcula en el trabajador, "la última gana".
    // Mientras llega la nueva se sigue dibujando la anterior del MISMO estado:
    // un parpadeo por frame sin mira sería peor que un cuadro de retraso.
    this.pedirPrevisualizacion({
      tipo: "previsualizar",
      mascara: estado.mascara,
      gravedad: estado.mundo.gravedad,
      deriva: estado.mundo.deriva,
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      planetas: estado.planetas,
      navesVivas,
      tirador,
      origenX,
      origenY,
      anguloGrados,
      potencia,
      armaId,
      aleatorio: estado.aleatorio,
    }, estado);
    const vigente = this.previsVigente;
    if (!vigente || vigente.estado !== estado) {
      window.__debug!.previsualizacion = null;
      window.__debug!.bandaDispersion = null;
      return;
    }
    const { banda, duracionMs: duracionComputoMs } = vigente;
    const puntos = banda.centro;

    // gravedad-visible (grav-vis-5): la promesa es que el preview no
    // miente -- si no cabe en su presupuesto de cómputo, se oculta antes
    // que dibujar un trazado que ya ha costado más de lo prometido.
    if (puntos.length < 2 || superaPresupuestoComputo(duracionComputoMs)) {
      window.__debug!.previsualizacion = null;
      window.__debug!.bandaDispersion = null;
      return;
    }

    // gravedad-visible (grav-vis-3, corrección): el ancho de línea vivía en
    // píxeles de MUNDO, que a este encuadre (p. ej. 1121x1156 mostrado en
    // un lienzo de ~360px CSS) da un trazo sub-píxel (0,64 px CSS medido
    // por el gatekeeper) -- invisible de por sí, y la mitad de tinta que
    // antes al pasar a punteado. Se expresa en píxeles de PANTALLA y se
    // convierte a mundo con displayScale.x (gameUnits/CSSpx), mismo patrón
    // que IndicadorDeriva y ContadorAdherencia.
    const grosorMiraMundoPx = ANCHO_MIRA_CSS_PX * this.scale.displayScale.x;
    this.graficosPrevisualizacion.lineStyle(grosorMiraMundoPx, 0x9ad1ff, 0.9);
    for (let i = 1; i < puntos.length; i++) {
      if (i % 2 === 0) continue;
      this.graficosPrevisualizacion.lineBetween(puntos[i - 1].x, puntos[i - 1].y, puntos[i].x, puntos[i].y);
    }

    // potencia-dispersion (pot-3, pot-4): la banda de riesgo. El cono real a
    // 95 % mide ~3 px CSS de ancho en su extremo: con los extremos a 2 px y
    // alfa 0,35 bajo la línea central de 3 px solo se leía como una línea
    // punteada más gorda (medido por el gatekeeper a 360x640). Se rellena el
    // área entre los extremos y se pintan estos con color claro y alfa alto,
    // para que contrasten con el centro en vez de fundirse con él. Se dibuja
    // siempre que haya amplitud, también por debajo del horizonte.
    if (banda.amplitudGrados > 0 && banda.extremoMenor.length >= 2 && banda.extremoMayor.length >= 2) {
      const poligono = [...banda.extremoMenor, ...[...banda.extremoMayor].reverse()].map((p) => new Phaser.Math.Vector2(p.x, p.y));
      this.graficosPrevisualizacion.fillStyle(COLOR_BANDA_DISPERSION, 0.3);
      this.graficosPrevisualizacion.fillPoints(poligono, true);
      const grosorExtremoMundoPx = ANCHO_EXTREMO_BANDA_CSS_PX * this.scale.displayScale.x;
      this.graficosPrevisualizacion.lineStyle(grosorExtremoMundoPx, COLOR_EXTREMO_BANDA, 0.85);
      for (const extremo of [banda.extremoMenor, banda.extremoMayor]) {
        for (let i = 1; i < extremo.length; i++) {
          this.graficosPrevisualizacion.lineBetween(extremo[i - 1].x, extremo[i - 1].y, extremo[i].x, extremo[i].y);
        }
      }
    }

    window.__debug!.previsualizacion = { puntos: puntos.map((p) => ({ x: p.x, y: p.y })), visible: true };
    window.__debug!.bandaDispersion = {
      extremoMenor: banda.extremoMenor.map((p) => ({ x: p.x, y: p.y })),
      extremoMayor: banda.extremoMayor.map((p) => ({ x: p.x, y: p.y })),
      amplitudGrados: banda.amplitudGrados,
    };
  }

  // Una sola petición de mira en vuelo; si mientras tanto cambia el ajuste, se
  // guarda solo la más reciente y se envía al volver la anterior.
  private pedirPrevisualizacion(peticion: Parameters<ClienteSim["previsualizar"]>[0], estado: EstadoPartida): void {
    const clave = JSON.stringify([peticion.tirador, peticion.origenX, peticion.origenY, peticion.anguloGrados, peticion.potencia, peticion.armaId]);
    if (this.previsClave === clave && this.previsEstadoPedido === estado) return;
    this.previsClave = clave;
    this.previsEstadoPedido = estado;
    this.previsPendiente = { peticion, estado };
    this.enviarPrevisualizacion();
  }

  private enviarPrevisualizacion(): void {
    if (this.previsEnCurso || !this.previsPendiente) return;
    const { peticion, estado } = this.previsPendiente;
    this.previsPendiente = null;
    this.previsEnCurso = true;
    void this.motor.previsualizar(peticion).then((resultado) => {
      this.previsEnCurso = false;
      if (resultado) this.previsVigente = { estado, banda: resultado.banda, duracionMs: resultado.duracionMs };
      this.enviarPrevisualizacion();
    });
  }

  // esc-2: con los propulsores elegidos la mira no es un disparo sino el círculo
  // de alcance y la ruta que seguiría la nave, calculada con el mismo
  // volarConPropulsores que luego resuelve avanzar(): lo que se ve es lo que se
  // vuela, incluida la gravedad vigente.
  private dibujarPrevisualizacionPropulsores(estado: EstadoPartida, anguloGrados: number, potencia: number): void {
    const nave = estado.naves[estado.turno];
    if (nave.y === undefined) return;
    const alcance = alcancePropulsores(estado.mundo);
    const otras = estado.naves.flatMap((otra, id) => (id !== estado.turno && otra.integridad > 0 && otra.y !== undefined ? [{ x: otra.x, y: otra.y }] : []));
    const vuelo = volarConPropulsores({ desde: { x: nave.x, y: nave.y }, anguloGrados, potencia, mundo: estado.mundo, mascara: estado.mascara, planetas: estado.planetas, otras });
    const grosor = ANCHO_MIRA_CSS_PX * this.scale.displayScale.x;
    const grafico = this.graficosPrevisualizacion;
    grafico.lineStyle(grosor, 0x7fd7ff, 0.8).strokeCircle(nave.x, nave.y, alcance);
    grafico.fillStyle(0x7fd7ff, 0.07).fillCircle(nave.x, nave.y, alcance);
    grafico.lineStyle(grosor, 0xffd23f, 0.95);
    for (let i = 1; i < vuelo.ruta.length; i++) {
      if (i % 2 === 0) continue;
      grafico.lineBetween(vuelo.ruta[i - 1].x, vuelo.ruta[i - 1].y, vuelo.ruta[i].x, vuelo.ruta[i].y);
    }
    grafico.fillStyle(0xffd23f, 0.95).fillCircle(vuelo.destino.x, vuelo.destino.y, 5 * this.scale.displayScale.x);
    window.__debug!.alcancePropulsores = alcance;
    window.__debug!.previsualizacionPropulsores = { puntos: vuelo.ruta.map((p) => ({ x: p.x, y: p.y })), motivo: vuelo.motivo };
    window.__debug!.previsualizacion = null;
  }

  // arma-granada-espoleta (gra-2, gra-3): publica cada fotograma los
  // segundos restantes del vuelo REAL en curso (nunca el de repetición, por
  // el mismo motivo que la estela) -- null en cuanto no hay una espoleta
  // encendida, para que el panel y window.__debug se apaguen solos sin que
  // ningún llamante tenga que acordarse de limpiarlos por su cuenta.
  private actualizarCuentaAtrasMecha(): void {
    const segundos = this.animador.obtenerSegundosRestantesMecha();
    if (segundos === null) {
      limpiarCuentaAtras();
      window.__debug!.cuentaAtrasMecha = null;
      this.ultimoIndiceTicMecha = null;
      return;
    }
    publicarCuentaAtras(segundos);
    window.__debug!.cuentaAtrasMecha = { segundosRestantes: segundos };
    // snd-2: segundos viene de la propia simulación de vuelo (determinista,
    // no del reloj real), así que comparar el índice cuantizado entre dos
    // fotogramas es en sí mismo determinista -- ver cadenciaTicTac.ts.
    const indice = indiceTic(segundos);
    if (indice !== this.ultimoIndiceTicMecha) {
      this.ultimoIndiceTicMecha = indice;
      reproducirEfecto("tictac-mecha");
    }
  }

  // arma-mina-adherente (min-2, min-3): publica cada fotograma la posición
  // de adherencia y los segundos restantes del vuelo REAL en curso (nunca
  // el de repetición) -- null en cuanto no hay una mina pegada contando,
  // para que el contador de mundo y window.__debug se apaguen solos. A
  // diferencia de actualizarCuentaAtrasMecha, esto NUNCA toca
  // cuentaAtrasStore (ese store alimenta el HUD fijo de la granada, que
  // min-2 exige mantener fuera de este contador).
  private actualizarCuentaAtrasAdherencia(): void {
    if (!this.animador.estaAdherido()) {
      this.contadorAdherencia.actualizar(null, null);
      window.__debug!.cuentaAtrasAdherencia = null;
      this.ultimoIndiceTicMina = null;
      return;
    }
    const posicion = this.animador.obtenerPosicion();
    const segundos = this.animador.obtenerSegundosRestantesAdherencia();
    this.contadorAdherencia.actualizar(posicion, segundos);
    if (posicion === null || segundos === null) {
      window.__debug!.cuentaAtrasAdherencia = null;
      this.ultimoIndiceTicMina = null;
      return;
    }
    window.__debug!.cuentaAtrasAdherencia = { x: posicion.x, y: posicion.y, segundosRestantes: segundos };
    // snd-2: mismo mecanismo que actualizarCuentaAtrasMecha, timbre distinto
    // (tictac-mina) para distinguir al oído cuál de las dos armas apremia.
    const indice = indiceTic(segundos);
    if (indice !== this.ultimoIndiceTicMina) {
      this.ultimoIndiceTicMina = indice;
      reproducirEfecto("tictac-mina");
    }
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
          naves: this.estado.naves.map((actual) => ({ ...actual, integridad: 100 })),
        };
        this.refrescarDebugNaves();
      } else if (this.puedeJugarAhora()) {
        const solucion = this.calcularSolucionBalistica(this.estado);
        const ajuste = solucion ?? { anguloGrados: 45, potencia: 55 };
        this.dispararEntrada(
          {
            arma: CATALOGO_ARMAS[0].id,
            anguloGrados: ajuste.anguloGrados,
            potencia: ajuste.potencia,
            objetivoId: this.objetivoDe(this.estado.turno),
          },
          true,
          true,
        );
      } else if (this.animador.enVuelo() || this.animadorRepeticion.enVuelo() || this.avanceTurnoPendiente) {
        // realce-impacto (rlc-1): avanceTurnoPendiente también cuenta como
        // "sigue resolviéndose" -- sin este caso, un impacto directo dentro
        // de la ráfaga caería en la guardia defensiva de abajo y la ráfaga
        // se cortaría antes de llegar al número de disparos pedido.
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
      this.esHumano(this.estado.turno) &&
      !this.animador.enVuelo() &&
      !this.animadorRepeticion.enVuelo() &&
      // realce-impacto (rlc-1): this.estado todavía es el de ANTES del
      // disparo mientras la sacudida no ha vuelto a reposo -- sin este gate,
      // un vuelo ya resuelto pero con el turno retrasado se leería como
      // "sigue siendo tu turno, sin animación", y el botón de disparar se
      // reactivaría antes de que el turno real haya pasado.
      !this.avanceTurnoPendiente &&
      !this.relevoPendiente &&
      !this.solicitudEnCurso
    );
  }

  private limpiarEntrada(): void {
    window.removeEventListener("pointerdown", this.manejarPointerDown);
    window.removeEventListener("pointermove", this.manejarPointerMove);
    window.removeEventListener("pointerup", this.manejarPointerFin);
    window.removeEventListener("pointercancel", this.manejarPointerFin);
    this.cancelarManejadorDisparo?.();
    this.cancelarManejadorDisparo = null;
    this.cancelarManejadorRepeticion?.();
    this.cancelarManejadorRepeticion = null;
    this.cancelarManejadorRelevo?.();
    this.cancelarManejadorRelevo = null;
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

    // Solo el toque que cae sobre el propio lienzo apunta: los que caen en
    // la consola o en un panel superpuesto siguen su camino normal.
    if (evento.target === this.game.canvas && this.puedeJugarAhora()) {
      this.punteroApuntando = evento.pointerId;
      this.apuntarHacia(evento.clientX, evento.clientY);
    }
  }

  private alPointerMove(evento: PointerEvent): void {
    if (this.punteroApuntando !== evento.pointerId) return;
    if (!this.puedeJugarAhora()) {
      this.punteroApuntando = null;
      return;
    }
    this.apuntarHacia(evento.clientX, evento.clientY);
  }

  private alPointerFin(evento: PointerEvent): void {
    if (this.punteroApuntando === evento.pointerId) this.punteroApuntando = null;
  }

  // Posición de la nave del turno en píxeles CSS, medida contra el rectángulo
  // real del lienzo (con Scale.FIT puede haber bandas laterales).
  private posicionPantallaNaveDelTurno(): { x: number; y: number } {
    const rect = this.game.canvas.getBoundingClientRect();
    const nave = this.estado.naves[this.estado.turno];
    const y = alturaRenderNave(nave.y, alturaSuperficie(this.estado.mascara, nave.x) ?? MUNDO_ALTO - 1);
    return { x: rect.left + (nave.x / MUNDO_ANCHO) * rect.width, y: rect.top + (y / MUNDO_ALTO) * rect.height };
  }

  private apuntarHacia(clienteX: number, clienteY: number): void {
    const nave = this.posicionPantallaNaveDelTurno();
    const dedo = { x: clienteX, y: clienteY };
    const ladoMenor = Math.min(window.innerWidth, window.innerHeight);
    fijarApuntadoDirecto(
      anguloDesdeDedo(nave, dedo),
      potenciaDesdeDistancia(Math.hypot(dedo.x - nave.x, dedo.y - nave.y), ladoMenor),
    );
  }

  // Resuelve el disparo YA (avanzar es puro y síncrono) y anima el vuelo con
  // la misma integración exacta -- el punto donde la animación deja de
  // moverse coincide con el impacto real porque es literalmente el mismo
  // cálculo, no una aproximación (ver AnimadorProyectil). esJugador
  // distingue el disparo que hay que recordar como "último disparo del
  // jugador" (control-5) del disparo automático de la máquina.
  private dispararEntrada(entrada: EntradaDeTurno, esJugador: boolean, sincrono = false): void {
    if (this.solicitudEnCurso) return;
    const estadoAntes = this.estado;
    if (estadoAntes.resultado.tipo === "terminada" || this.animador.enVuelo()) {
      return;
    }
    // contacto-honesto: un roce viejo no debe seguir en pantalla una vez que
    // ya se está resolviendo el disparo siguiente.
    // arma-granada-espoleta (gra-2): mismo motivo que limpiarRoce() -- una
    // cuenta atrás vieja no debe quedarse en pantalla al empezar el disparo
    // siguiente (que puede ni siquiera ser una granada).
    limpiarCuentaAtras();
    // sonido-procedimental (snd-2): el disparo se marca aquí, el único punto
    // que dispara un turno real (jugador o IA) -- nunca en los guiones de
    // prueba (jugarTurnosGuionizados, forzarFinDePartida), igual que la
    // estela de proy-4/proy-5.
    reproducirEfecto("disparo");

    const tirador: IdNave = estadoAntes.turno;
    const naveTiradora = estadoAntes.naves[tirador];
    const origenX = naveTiradora.x;
    const origenY = naveTiradora.y ?? alturaSuperficie(estadoAntes.mascara, origenX) ?? estadoAntes.mundo.alto - 1;

    const continuar = (resultadoAvance: ReturnType<typeof avanzar>): void => {
      const { estado: estadoDespues, eventos, categoriaBroma, detonaciones } = resultadoAvance;

      const eventoImpacto = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> => evento.tipo === "impacto");

      // ia-5: se mide AQUÍ (jugarTurno/avanzar ya ha resuelto el disparo real
      // de la máquina), no dentro de crearFuenteIA -- esa fuente no puede ver
      // el resultado de su propio tiro (ver fuente.ts). Se guarda para el
      // siguiente turno de la máquina, cuando el objetivo sigue siendo el
      // jugador (el único emparejamiento posible en esta partida real).
      if (!esJugador) {
        // multi-setup-partida: el objetivo REAL de la IA (el que eligió
        // elegirObjetivo en fuente.ts), no el rival más cercano en 2D de los
        // humanos -- los dos criterios pueden discrepar con 3+ naves.
        const objetivoId = entrada.objetivoId;
        const memoria = this.memoriaDe(tirador);
        const naveObjetivoAntes = estadoAntes.naves[objetivoId];
        const objetivoX = naveObjetivoAntes.x;
        const objetivoY = naveObjetivoAntes.y ?? alturaSuperficie(estadoAntes.mascara, objetivoX) ?? estadoAntes.mundo.alto - 1;
        const puntoDeCaida = eventoImpacto ?? { x: origenX, y: origenY };
        // impacto-naves/ia-multipozo: distancia 2D euclídea al objetivo
        // (imp-3), nunca solo en X -- en modo espacial (naves a distinta
        // altura) la distancia en X por sí sola subestima un disparo que pasó
        // muy por encima o por debajo.
        const distancia = Math.hypot(puntoDeCaida.x - objetivoX, puntoDeCaida.y - objetivoY);
        if (distancia > UMBRAL_FALLO_PX) memoria.fallosConsecutivos += 1;

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
        memoria.turnosSeguidosSinDanio = danioCausado > 0 ? 0 : memoria.turnosSeguidosSinDanio + 1;

        // ia-n7: nunca baja, igual que fallosConsecutivos -- ver el comentario
        // del campo en la clase.
        if (danioCausado < UMBRAL_DANIO_SUFICIENTE_POR_TURNO) {
          memoria.turnosSeguidosDanioInsuficiente += 1;
        }

        memoria.ultimoIntento = {
          distanciaAlObjetivoPx: distancia,
          fallosConsecutivos: memoria.fallosConsecutivos,
          turnosSeguidosSinDanio: memoria.turnosSeguidosSinDanio,
          turnosSeguidosDanioInsuficiente: memoria.turnosSeguidosDanioInsuficiente,
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
      this.origenUltimoDisparo = { x: inicial.x, y: inicial.y };

      // impacto-naves: mismo criterio que avanzar.ts para decidir si hay
      // cuerpo de colisión de casco -- modo espacial (las dos naves con `y`) y
      // solo naves vivas. Sin este rastreador, la vista no sabía que un casco
      // podía terminar el vuelo antes que el suelo o el presupuesto (ver
      // AnimadorProyectil.ts).
      const naveObjetivoAntes = estadoAntes.naves[this.objetivoDe(tirador)];
      const modoEspacial = naveTiradora.y !== undefined && naveObjetivoAntes.y !== undefined;
      const navesVivas = modoEspacial
        ? estadoAntes.naves
            .map((nave, id) => ({ id: id as IdNave, nave }))
            .filter(({ nave }) => nave.integridad > 0)
            .map(({ id, nave }) => ({ id, x: nave.x, y: nave.y as number, integridad: nave.integridad }))
        : undefined;
      const rastreadorNaves = navesVivas ? crearRastreadorImpactoNaves(navesVivas, tirador) : undefined;

      // humor-6: se guarda de CUALQUIER disparo (jugador o IA) el mismo objeto
      // `inicial` que se le pasa al animador real -- integrarPasoProyectil
      // devuelve estados nuevos en cada paso (nunca muta el que recibe), así
      // que esta referencia sigue intacta cuando se pida la repetición.
      const armaDisparada = buscarArma(entrada.arma);
      // arma-mosca (mos-3): mismo aleatorio hilvanado que resolverDisparo usó
      // como semilla de la perturbación -- válido porque la mosca declara
      // fiabilidad 1 y ninguna dispersionGrados (ningún eje anterior a la
      // resolución de vuelo consume tirada), así que estadoAntes.aleatorio es
      // EXACTAMENTE lo que vio simularVuelo. Un arma futura "erratico" que sí
      // declare esos ejes necesitaría hilvanar aquí lo mismo que resolver.ts.
      const perturbacion = insumoPerturbacionErratica(armaDisparada.comportamiento, estadoAntes.aleatorio);
      // arma-granada-espoleta (gra-1, gra-4): mismos pasos que ya usó
      // resolverDisparo (resolver.ts) para resolver este mismo disparo --
      // pasosDeMecha() es la única conversión segundos->pasos, consumida aquí
      // y en el núcleo, nunca reimplementada aparte en el cliente.
      const pasosHastaDetonarMecha =
        armaDisparada.comportamiento.tipo === "mecha"
          ? this.fusibleMechaForzadoPasos ?? pasosDeMecha(armaDisparada.comportamiento.segundosHastaDetonar)
          : undefined;
      this.fusibleMechaForzadoPasos = null;
      // arma-mina-adherente (min-1, min-4): mismo cálculo que el núcleo
      // (resolverDisparo, vía resolver.ts) para la mecha DE LA ADHERENCIA --
      // esComportamientoAdherente() es la misma condición de datos que ya
      // consumía el núcleo, nunca una comparación de arma.id aparte.
      const pasosHastaDetonarTrasAdherencia =
        esComportamientoAdherente(armaDisparada.comportamiento) && armaDisparada.comportamiento.tipo === "adherente-con-mecha"
          ? this.fusibleAdherenciaForzadoPasos ?? pasosDeMecha(armaDisparada.comportamiento.segundosHastaDetonar)
          : undefined;
      this.fusibleAdherenciaForzadoPasos = null;
      // mos-3: insumos completos del vuelo -- el e2e reconstruye la trayectoria
      // RESUELTA llamando a simularVuelo en Node con estos mismos valores, sin
      // depender de que el núcleo la exponga en ningún estado serializable.
      window.__debug!.ultimoDisparo = {
        ...window.__debug!.ultimoDisparo!,
        armaId: entrada.arma,
        inicial,
        gravedad: estadoAntes.mundo.gravedad,
        deriva: estadoAntes.mundo.deriva,
        aleatorioAntes: estadoAntes.aleatorio,
        planetas: estadoAntes.planetas,
      };

      this.ultimoVueloParaRepetir = {
        inicial,
        gravedad: estadoAntes.mundo.gravedad,
        deriva: estadoAntes.mundo.deriva,
        detenerse,
        planetas: estadoAntes.planetas,
        navesParaRastreador: navesVivas,
        tiradorId: tirador,
        arma: armaDisparada,
        perturbacion,
        pasosHastaDetonarMecha,
        pasosHastaDetonarTrasAdherencia,
      };

      this.animador.fijarEncuadre({ ancho: estadoAntes.mundo.ancho, alto: estadoAntes.mundo.alto });
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
        // arma-mosca (mos-3): la trayectoria animada de ESTE vuelo, expuesta
        // tras terminar -- el e2e la compara paso a paso contra
        // ResultadoVuelo.trayectoria del mismo disparo, resuelto de nuevo en
        // Node con el mismo aleatorio/magnitud (ver comentario de perturbacion
        // más arriba).
        window.__debug!.trayectoriaAnimadaUltimoVuelo = this.animador.obtenerTrayectoria();
        // arma-granada-espoleta (gra-2, gra-3): la cuenta atrás termina junto
        // con el vuelo -- limpiarla aquí (y no solo esperar al siguiente
        // disparo) evita que el "0" se quede pegado en pantalla durante el
        // resto del turno mientras se resuelve el impacto.
        limpiarCuentaAtras();
        window.__debug!.cuentaAtrasMecha = null;
        // arma-mina-adherente (min-2, min-3): mismo motivo que la granada --
        // el contador de mundo no debe quedarse pegado en pantalla mientras
        // se resuelve el impacto y responde la máquina.
        window.__debug!.cuentaAtrasAdherencia = null;
        this.contadorAdherencia.actualizar(null, null);
        // realce-impacto (rlc-1): alAvanzarTurno encadena la respuesta de la
        // IA DESPUÉS de que el turno haya avanzado de verdad (inmediato, o
        // retrasado hasta que la sacudida vuelva a reposo) -- mismo motivo que
        // ya explicaba este comentario antes de este bloque: evita que
        // jugarTurnosGuionizados/forzarFinDePartida, que también llaman a
        // aplicarResultadoTurno pero con su propio guion de fuentes y SIN
        // estas opciones, disparen un turno extra no contado por su bucle.
        this.aplicarResultadoTurno(estadoDespues, eventos, categoriaBroma, entrada.arma, {
          detonaciones,
          retrasarSiHaySacudida: true,
          alAvanzarTurno: () => {
            if (this.esHumano(tirador)) this.ultimoHumano = tirador;
            if (this.estado.resultado.tipo !== "terminada" && !this.esHumano(this.estado.turno)) {
              this.dispararTurnoIA();
            } else if (this.estado.resultado.tipo !== "terminada") {
              this.abrirRelevoSiHaceFalta(estadoAntes, estadoDespues, entrada.arma);
            }
          },
        });
        },
        estadoAntes.planetas,
        rastreadorNaves,
        armaDisparada,
        perturbacion,
        pasosHastaDetonarMecha,
        pasosHastaDetonarTrasAdherencia,
      );
    };
    // respuesta-200ms: los hooks de prueba que encadenan turnos a mano piden el
    // camino síncrono; el juego real resuelve en el trabajador.
    if (sincrono) {
      continuar(avanzar(estadoAntes, entrada));
      return;
    }
    this.solicitudEnCurso = true;
    publicarJugable(false);
    void this.motor.resolverDisparo({ tipo: "resolverDisparo", estado: estadoAntes, entrada }).then((resultadoAvance) => {
      this.solicitudEnCurso = false;
      if (resultadoAvance === null) {
        publicarJugable(this.puedeJugarAhora());
        return;
      }
      continuar(resultadoAvance);
    });
  }

  // escudo-y-propulsores: el turno entero se gasta en equipo, sin vuelo de
  // proyectil que animar. Comparte con el disparo el cierre de turno
  // (aplicarResultadoTurno) y el relevo, para que la IA o el siguiente humano
  // jueguen exactamente igual que tras un disparo.
  private usarEquipoEntrada(entrada: EntradaDeTurno, esJugador: boolean): void {
    const estadoAntes = this.estado;
    if (estadoAntes.resultado.tipo === "terminada" || this.animador.enVuelo()) return;
    limpiarCuentaAtras();
    const tirador: IdNave = estadoAntes.turno;
    const { estado: estadoDespues, eventos, categoriaBroma, detonaciones } = avanzar(estadoAntes, entrada);
    if (esJugador) this.ultimoHumano = tirador;
    publicarJugable(false);
    this.aplicarResultadoTurno(estadoDespues, eventos, categoriaBroma, undefined, {
      detonaciones,
      alAvanzarTurno: () => {
        if (this.esHumano(tirador)) this.ultimoHumano = tirador;
        if (this.estado.resultado.tipo !== "terminada" && !this.esHumano(this.estado.turno)) {
          this.dispararTurnoIA();
        } else if (this.estado.resultado.tipo !== "terminada") {
          this.abrirRelevoSiHaceFalta(estadoAntes, estadoDespues, entrada.arma);
        }
      },
    });
  }

  // Tras resolver un disparo del jugador, si la partida sigue y el turno es
  // de la máquina, la máquina dispara sola -- así control-1 comprueba el
  // circuito completo (elegir, apuntar, disparar, responder) sin que el
  // bloque siguiente (partida-completa) tenga que reconstruir este enganche.
  private dispararTurnoIA(): void {
    const tirador = this.estado.turno;
    const memoria = this.memoriaDe(tirador);
    const personalidad = this.controladores[tirador]?.personalidad ?? this.rival;
    this.solicitudEnCurso = true;
    publicarJugable(false);
    mostrarApuntandoIA(nombreDeNave(this.controladores, tirador));
    void this.motor
      .decidirIA({
        tipo: "decidirIA",
        estado: this.estado,
        personalidad,
        ultimoIntento: memoria.ultimoIntento,
        usosPorArma: memoria.usosPorArma,
        danioRecibidoDesdeSuTurno: memoria.danioRecibidoDesdeSuTurno,
      })
      .then((decision) => {
        this.solicitudEnCurso = false;
        ocultarApuntandoIA();
        if (decision === null) return;
        const { entrada, estado } = decision;
        this.estado = estado;
        memoria.danioRecibidoDesdeSuTurno = false;
        if (entrada.accion !== undefined && entrada.accion !== "disparo") {
          this.usarEquipoEntrada(entrada, false);
          return;
        }
        memoria.usosPorArma = { ...memoria.usosPorArma, [entrada.arma]: (memoria.usosPorArma[entrada.arma] ?? 0) + 1 };
        this.dispararEntrada(entrada, false);
      });
  }

  // relevo-turno: solo entre dos humanos distintos y solo si la partida no
  // pidió "todos vemos todo". Con un único humano ultimoHumano siempre
  // coincide con el turno y nunca se abre.
  private abrirRelevoSiHaceFalta(estadoAntes: EstadoPartida, estadoDespues: EstadoPartida, armaId: string): void {
    const siguiente = estadoDespues.turno;
    if (this.datosEscena.todosVemosTodo || !this.datosEscena.jugadores) return;
    if (this.ultimoHumano === null || this.ultimoHumano === siguiente || !this.esHumano(siguiente)) return;
    const tirador = estadoAntes.turno;
    const danio = estadoAntes.naves.reduce(
      (suma, nave, id) => (id === tirador ? suma : suma + Math.max(0, nave.integridad - estadoDespues.naves[id].integridad)),
      0,
    );
    const impacto = obtenerBromas().impacto;
    this.relevoPendiente = true;
    publicarJugable(false);
    publicarRelevo(
      nombreDeNave(this.controladores, siguiente),
      {
        tirador: nombreDeNave(this.controladores, tirador),
        arma: esIdEquipo(armaId) ? buscarEquipo(armaId).nombre : buscarArma(armaId).nombre,
        danio,
        fallo: danio === 0,
        eliminadas: estadoAntes.naves.flatMap((nave, id) =>
          nave.integridad > 0 && estadoDespues.naves[id].integridad <= 0 ? [nombreDeNave(this.controladores, id)] : [],
        ),
      },
      impacto,
    );
  }

  private confirmarRelevoActual(): void {
    if (!this.relevoPendiente) return;
    this.relevoPendiente = false;
    cerrarRelevo();
    // El arma que dejó elegida el jugador anterior no debe llegar
    // preseleccionada al siguiente.
    seleccionarArma(CATALOGO_ARMAS[0].id);
    publicarJugable(this.puedeJugarAhora());
  }

  private esHumano(id: IdNave): boolean {
    return this.controladores[id]?.tipo === "humano";
  }

  private objetivoDe(tirador: IdNave): IdNave {
    return objetivoMasCercano(this.estado, tirador);
  }

  private memoriaDe(id: IdNave): MemoriaIA {
    let memoria = this.memoriaIA.get(id);
    if (!memoria) {
      memoria = memoriaIAInicial();
      this.memoriaIA.set(id, memoria);
    }
    return memoria;
  }

  // Todos los asientos, también las IAs, arrancan con el mismo presupuesto y
  // pagan cada arma de pago al usarla: no hay pantalla previa de compra.
  private economiaInicial(saldoInicial: number): Pick<EstadoPartida, "saldos"> {
    return {
      // Sin arrastre: cada partida y cada asiento parten del mismo saldo.
      saldos: this.controladores.map(() => saldoInicial),
    };
  }

  // Extraído de aplicarResultadoTurno para que window.__debug.dispararEventoRoce
  // (pruebas) pueda reproducir exactamente el mismo camino que un turno real,
  // en vez de duplicar la lógica de emisores/HUD -- mismo motivo que
  // crearEventoDePruebaHumor para los eventos de humor.
  // realce-impacto (rlc-1): devuelve cuántos ms hay que esperar a que la
  // sacudida de cámara dispare para que aplicarResultadoTurno pueda retrasar
  // el avance de turno hasta que la cámara vuelva a reposo -- 0 si ningún
  // evento la disparó (roce, impacto sin daño, o ajuste desactivado).
  // cat-2: el rayo se pinta ENTERO de una vez (nave → punto de impacto) y se
  // apaga a los DURACION_HAZ_MS: no es un proyectil que viaje. Va justo antes
  // de la explosión del punto final, que ya registra el núcleo.
  private dibujarHazLaser(detonaciones: readonly Detonacion[]): DebugEfectoVisible | null {
    const final = detonaciones[0];
    const origen = this.origenUltimoDisparo;
    if (!final || !origen || buscarArma(final.armaId).comportamiento.tipo !== "instantaneo") return null;
    const trazo = 1 / this.scale.displayScale.x;
    const grafico = this.add.graphics().setDepth(31);
    grafico.lineStyle(6 * trazo, 0xff2e63, 0.9).lineBetween(origen.x, origen.y, final.x, final.y);
    grafico.lineStyle(2 * trazo, 0xffe3ea, 1).lineBetween(origen.x, origen.y, final.x, final.y);
    this.tweens.add({ targets: grafico, alpha: 0, duration: DURACION_HAZ_MS, onComplete: () => grafico.destroy() });
    return { tipo: "haz-laser", duracionMs: DURACION_HAZ_MS, desde: { x: origen.x, y: origen.y }, x: final.x, y: final.y, radioOnda: 0, particulas: 0, escala: 0, sobre: final.sobre };
  }

  // salida-pantalla: el aviso «¡Perdido!» pegado al borde por el que salió el
  // tiro, 1,2 s. Con movimiento reducido no hay destello ni fundido, solo el
  // texto. El rectángulo se publica en __debug porque el texto vive en el
  // lienzo y ningún selector de DOM lo ve.
  private mostrarAvisoPerdido(salida: { borde: string; x: number; y: number }, movimientoReducido: boolean): void {
    const { ancho, alto } = this.estado.mundo;
    const escala = 1 / this.scale.displayScale.x;
    const texto = this.add
      .text(0, 0, "¡Perdido!", { fontFamily: "sans-serif", fontSize: `${Math.round(22 * escala)}px`, fontStyle: "bold", color: "#ffd166", stroke: "#000000", strokeThickness: Math.round(4 * escala) })
      .setDepth(2000);
    const margen = 8 * escala;
    const x = Math.min(ancho - texto.width - margen, Math.max(margen, salida.x - texto.width / 2));
    const y = Math.min(alto - texto.height - margen, Math.max(margen, salida.y - texto.height / 2));
    texto.setPosition(salida.borde === "derecha" ? ancho - texto.width - margen : salida.borde === "izquierda" ? margen : x, salida.borde === "arriba" ? margen : salida.borde === "abajo" ? alto - texto.height - margen : y);
    window.__debug!.avisoPerdido = { borde: salida.borde, x: texto.x, y: texto.y, ancho: texto.width, alto: texto.height };
    if (!movimientoReducido) {
      this.cameras.main.flash(120, 255, 209, 102, false);
    }
    this.time.delayedCall(DURACION_AVISO_PERDIDO_MS, () => texto.destroy());
  }

  private manejarEventosVisuales(eventos: readonly EventoSimulacion[], detonaciones: readonly Detonacion[]): number {
    let esperaSacudidaMs = 0;
    const movimientoReducido = prefiereMovimientoReducido();
    window.__debug!.detonaciones = detonaciones;
    if (detonaciones.length > 0) this.medidorFrames.marcar("impacto");
    if (eventos.some((evento) => evento.tipo === "proyectil-perdido")) this.medidorFrames.marcar("salida");
    const lanzadas = reproducirDetonaciones(
      detonaciones,
      this.explosionPorCapas,
      1 / this.scale.displayScale.x,
      movimientoReducido,
      (nombre) => this.medidorFrames.marcar(nombre),
    );
    const ultima = lanzadas[lanzadas.length - 1];
    if (ultima) window.__debug!.ultimaExplosionPorCapas = ultima;
    const explosiones = lanzadas.map((datos) => ({
      tipo: "explosion" as const,
      x: datos.x,
      y: datos.y,
      radioOnda: datos.radioOnda,
      particulas: datos.particulas,
      escala: datos.escala,
      sobre: datos.sobre,
    }));
    const haz = this.dibujarHazLaser(detonaciones);
    window.__debug!.efectosVisibles = haz ? [haz, ...explosiones] : explosiones;
    for (const evento of eventos) {
      if (evento.tipo === "proyectil-perdido" && evento.salida) {
        this.mostrarAvisoPerdido(evento.salida, movimientoReducido);
      }
      if (evento.tipo === "impacto") {
        // sonido-procedimental (snd-2): distinto de "roce" de abajo -- el
        // mismo contraste que ya hace contacto-honesto a nivel visual, ahora
        // también al oído, sin importar si el impacto hizo daño o no (eso lo
        // sigue distinguiendo el propio timbre de "impacto" frente al "roce",
        // no una tercera variante).
        reproducirEfecto("impacto");
        // Con movimiento reducido no se emite ninguna partícula: el anillo y
        // el destello de ExplosionPorCapas ya informan del impacto.
        if (evento.danio > 0) {
          if (!movimientoReducido) {
            comprobarCantidadDentroDelTecho("explosion-con-danio", CANTIDAD_PARTICULAS_EXPLOSION);
            this.emisorExplosion.explode(CANTIDAD_PARTICULAS_EXPLOSION, evento.x, evento.y);
          }
          window.__debug!.ultimoTipoExplosion = "danio";
        } else {
          if (!movimientoReducido) {
            comprobarCantidadDentroDelTecho("explosion-sin-danio", CANTIDAD_PARTICULAS_EXPLOSION_SIN_DANIO);
            this.emisorExplosionSinDanio.explode(CANTIDAD_PARTICULAS_EXPLOSION_SIN_DANIO, evento.x, evento.y);
          }
          window.__debug!.ultimoTipoExplosion = "sin-danio";
        }
        // Solo cuando el punto de impacto ha tocado la silueta (impactoNave),
        // nunca en una detonación normal contra el terreno.
        if (evento.impactoNave !== undefined) {

          // realce-impacto (rlc-1, rlc-2): solo en el impacto que de verdad
          // hizo daño -- un impacto a cero daño se queda con el destello de
          // contacto honesto de arriba, sin sacudida ni destello rojo, igual
          // que un roce (que ni siquiera entra en esta rama). Con el ajuste
          // desactivado (rlc-3), ningún desplazamiento de cámara.
          if (evento.danio > 0 && obtenerEstadoControl().sacudidaActiva && !movimientoReducido) {
            const amplitud = amplitudSacudida(evento.danio);
            this.sacudirCamara(DURACION_SACUDIDA_IMPACTO_MS, amplitud);
            this.naves[evento.impactoNave].destellarDanio(intensidadDestelloDanio(evento.danio));
            window.__debug!.ultimoRealceImpacto = { danio: evento.danio, amplitud };
            esperaSacudidaMs = Math.max(esperaSacudidaMs, DURACION_SACUDIDA_IMPACTO_MS);
          }
        }
      }
    }
    return esperaSacudidaMs;
  }

  private aplicarResultadoTurno(
    estadoDespues: EstadoPartida,
    eventos: readonly EventoSimulacion[],
    categoriaBroma?: CategoriaBroma,
    armaId?: string,
    // realce-impacto (rlc-1): opciones EXCLUSIVAS del turno animado real
    // (ver el callback de this.animador.iniciar más arriba) -- ninguno de
    // los otros tres llamadores (proyectil-perdido, jugarTurnosGuionizados,
    // forzarFinDePartida) las pasa, así que su avance sigue siendo
    // síncrono, exactamente igual que antes de este bloque: esos guiones no
    // corren el update() de Phaser entre turnos, y una sacudida retrasada
    // ahí se quedaría pendiente para siempre, no solo unos ms.
    opciones?: {
      // explosiones-visuales: una explosión por entrada, tal como las declara
      // el núcleo; la escena no deduce dónde estalló nada.
      readonly detonaciones?: readonly Detonacion[];
      readonly retrasarSiHaySacudida?: boolean;
      readonly alAvanzarTurno?: () => void;
    },
  ): void {
    // estadoAntes es this.estado ANTES de reasignarlo más abajo -- se captura
    // aquí (y no en cada llamador) para que jugarTurnosGuionizados y
    // forzarFinDePartida, que también pasan por esta función con su propio
    // guion, acumulen estadísticas y disparen reacciones igual que un disparo
    // real del jugador o de la IA.
    const estadoAntes = this.estado;
    const tirador = estadoAntes.turno;
    this.limpiarMarcasFantasma();
    estadoDespues.naves.forEach((nave, id) => {
      if (nave.integridad < estadoAntes.naves[id].integridad) this.memoriaDe(id).danioRecibidoDesdeSuTurno = true;
    });
    this.actualizarEstadisticas(tirador, estadoAntes, estadoDespues, eventos);
    window.__debug!.ultimosEventos = eventos;
    if (armaId !== undefined) window.__debug!.ultimaEntrada = { nave: tirador, arma: armaId };

    this.terreno.sincronizarDesde(estadoDespues.mascara);

    const esperaSacudidaMs = this.manejarEventosVisuales(eventos, opciones?.detonaciones ?? []);
    // mrb-1: el robot que detona se retira en el mismo instante que su
    // explosión; si esperara a avanzarTurno (retrasado por la sacudida), se
    // vería el robot vivo junto a su propia explosión.
    if (eventos.some((evento) => evento.tipo === "robot-detona")) this.retirarRobotsDetonados(estadoDespues);
    this.reaccionarAHumor(eventos);
    if (categoriaBroma) {
      this.reaccionarABroma(tirador, estadoAntes.numeroTurno, categoriaBroma, eventos, armaId ? buscarArma(armaId) : undefined);
    }
    // multi-setup-partida: con varios jugadores, una eliminación se anuncia
    // con el nombre de quien cae, en el mismo canal del resumen del turno.
    // Sin `jugadores` (partida de siempre) el texto no cambia.
    const eliminadas = this.datosEscena.jugadores
      ? estadoAntes.naves.flatMap((nave, id) => (nave.integridad > 0 && estadoDespues.naves[id].integridad <= 0 ? [id] : []))
      : [];
    publicarResultadoTurno(
      [resumenTurno(eventos), ...eliminadas.map((id) => `${nombreDeNave(this.controladores, id)} queda eliminada.`)].join(" "),
    );
    window.__debug!.eliminadas = [...(window.__debug!.eliminadas ?? []), ...eliminadas];

    // rlc-1: "la sacudida... termina siempre antes de que el turno pase al
    // siguiente jugador" -- numeroTurno (dentro de estadoDespues) no avanza
    // hasta que la cámara ya volvió a reposo, en vez de en el mismo tick en
    // que la sacudida arranca.
    const avanzarTurno = (): void => {
      this.estado = estadoDespues;
      this.refrescarNaves();
      this.refrescarDebugNaves();
      this.animarDesplazamientos(eventos);
      this.refrescarEconomia();
      this.refrescarRobots();
      this.refrescarObjetos();
      this.refrescarUniverso(eventos);
      window.__debug!.turno = this.estado.turno;
      window.__debug!.numeroTurno = this.estado.numeroTurno;
      publicarTurno(this.estado.turno);
      publicarJugable(this.puedeJugarAhora());

      if (estadoDespues.resultado.tipo === "terminada") {
        // nucleo-n-naves: el empate (ganador null) solo es posible con 3+
        // naves vivas simultáneamente antes del disparo que decide la
        // partida -- esta escena sigue siendo estrictamente de 2 (ver
        // rivalDe), así que avanzar() nunca le produce ese caso.
        // multi-setup-partida: con 3-4 naves el empate es posible y el
        // ganador ya puede ser cualquiera; para el parte de guerra se usa la
        // estadística de quien dispara en el último turno si no hay ganador.
        const idGanador = estadoDespues.resultado.ganador;
        publicarGanador(
          idGanador === null ? null : nombreDeNave(this.controladores, idGanador),
          idGanador !== null && this.controladores[idGanador]?.tipo === "humano",
        );
        window.__debug!.ganador = idGanador;
        const estadisticasGanador = this.estadisticas[idGanador ?? tirador];
        const parte = generarParteDeGuerra(estadisticasGanador);
        publicarParteDeGuerra(parte, estadisticasGanador);
        window.__debug!.parteDeGuerra = { ...parte, estadisticas: estadisticasGanador };
        // partida-5: intento de guardado best-effort -- si localStorage no
        // está disponible, guardarUltimaPartida se degrada en silencio (ver
        // progreso.ts) y la partida ya jugada no se pierde por eso.
        guardarUltimaPartida(parte, estadisticasGanador);
      }
      opciones?.alAvanzarTurno?.();
    };

    if (opciones?.retrasarSiHaySacudida && esperaSacudidaMs > 0) {
      this.avanceTurnoPendiente = { restanteMs: esperaSacudidaMs, avanzar: avanzarTurno };
    } else {
      avanzarTurno();
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
    // Un turno de equipo no es un disparo: no cuenta para el parte de guerra.
    if (!eventos.some((evento) => evento.tipo === "disparo")) return;
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

  // Único punto por el que se sacude la cámara: el contador es lo que el e2e
  // de movimiento reducido lee para comprobar que no hubo ninguna.
  private sacudirCamara(duracionMs: number, intensidad: number): void {
    this.cameras.main.shake(duracionMs, intensidad);
    window.__debug!.sacudidasCamara = (window.__debug!.sacudidasCamara ?? 0) + 1;
  }

  // humor-1, humor-2: sacudida de cámara, tono y frase contextual para cada
  // evento de humor del turno -- la voz que narra es siempre la del rival
  // elegido (this.rival), también cuando el evento le ha pasado al jugador,
  // porque solo hay un rival por partida.
  private reaccionarAHumor(eventos: readonly EventoSimulacion[]): void {
    for (const evento of eventos) {
      if (!esEventoHumor(evento)) continue;
      if (!prefiereMovimientoReducido()) this.sacudirCamara(DURACION_SACUDIDA_MS, INTENSIDAD_SACUDIDA);
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
    arma?: Arma,
  ): void {
    const personalidadTirador = this.controladores[tirador]?.personalidad;
    const voz = personalidadTirador ? vozDeNave(1, personalidadTirador.id) : vozDeNave(0, this.rival.id);
    let textoDisparo: string | null = null;
    if (debeMostrarBromaDeDisparo(FRECUENCIA_BROMAS_POR_DEFECTO, numeroTurnoAntes)) {
      textoDisparo = this.selectorBromas.elegirDisparo(voz);
      // arma-mosca (mos-5): la broma propia del arma se AÑADE a la de la voz,
      // nunca la sustituye -- así hum-1..hum-7 siguen viendo intacta la frase
      // de personalidad de siempre, y el catálogo entero salvo el arma que
      // declare bromaPropia se comporta exactamente como antes de este bloque.
      if (arma?.bromaPropia) {
        textoDisparo = `${textoDisparo} ${this.selectorBromas.elegirDisparoArma(arma.id, arma.bromaPropia.disparo)}`;
      }
      publicarBromaDisparo(numeroTurnoAntes, textoDisparo);
    }
    let textoImpacto = this.selectorBromas.elegirImpacto(voz, categoria);
    if (arma?.bromaPropia) {
      textoImpacto = `${textoImpacto} ${this.selectorBromas.elegirImpactoArma(arma.id, arma.bromaPropia.impacto)}`;
    }
    publicarBromaImpacto(numeroTurnoAntes, textoImpacto, categoria, tirador);

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
    const {
      inicial,
      gravedad,
      deriva,
      detenerse,
      planetas,
      navesParaRastreador,
      tiradorId,
      arma,
      perturbacion,
      pasosHastaDetonarMecha,
      pasosHastaDetonarTrasAdherencia,
    } = this.ultimoVueloParaRepetir;
    // Rastreador fresco en cada repetición: es con estado (gracia del propio
    // casco) y no puede reutilizar la instancia del vuelo real ni la de una
    // repetición anterior.
    const rastreadorNaves = navesParaRastreador ? crearRastreadorImpactoNaves(navesParaRastreador, tiradorId) : undefined;
    window.__debug!.impactoRepeticion = null;
    this.animadorRepeticion.fijarEncuadre({ ancho: this.estado.mundo.ancho, alto: this.estado.mundo.alto });
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
      perturbacion,
      pasosHastaDetonarMecha,
      pasosHastaDetonarTrasAdherencia,
    );
  }

  private limpiarMarcasFantasma(): void {
    for (const marca of this.marcasFantasma) marca.destroy();
    this.marcasFantasma = [];
    window.__debug!.fantasmas = [];
    publicarFantasmas([]);
  }

  // La nave ya está en su destino en el estado (refrescarNaves); aquí solo se
  // adelanta visualmente a donde estaba y se desliza, y se deja la marca en el
  // origen. Con movimiento reducido salta directa, sin tween.
  private animarDesplazamientos(eventos: readonly EventoSimulacion[]): void {
    const movimientoReducido = prefiereMovimientoReducido();
    const fantasmas: { nave: number; x: number; y: number }[] = [];
    for (const evento of eventos) {
      if (evento.tipo !== "desplazamiento" && evento.tipo !== "propulsores") continue;
      if (evento.tipo === "desplazamiento" && evento.reserva === "se-queda") continue;
      if (evento.tipo === "propulsores" && evento.desdeX === evento.x && evento.desdeY === evento.y) continue;
      const nave = this.naves[evento.nave];
      const desdeY = alturaRenderNave(evento.desdeY, evento.desdeY);
      const haciaY = alturaRenderNave(evento.y, evento.y);

      const grafico = this.add.graphics().setDepth(29);
      grafico.lineStyle(4, 0xffffff, 0.7).strokeCircle(evento.desdeX, desdeY, RADIO_MARCA_FANTASMA_U);
      const texto = this.add
        .text(evento.desdeX, desdeY + RADIO_MARCA_FANTASMA_U + 6, "Estaba aquí", {
          fontSize: `${TAMANO_TEXTO_FANTASMA_PX}px`,
          color: "#ffffff",
        })
        .setOrigin(0.5, 0)
        .setAlpha(0.8)
        .setDepth(29);
      this.marcasFantasma.push(grafico, texto);
      fantasmas.push({ nave: evento.nave, x: evento.desdeX, y: desdeY });

      if (movimientoReducido) continue;
      nave.posicionarEn(evento.desdeX, desdeY);
      const progreso = { t: 0 };
      this.tweens.add({
        targets: progreso,
        t: 1,
        duration: DURACION_DESLIZAMIENTO_MS,
        ease: "Sine.easeInOut",
        onUpdate: () =>
          nave.posicionarEn(evento.desdeX + (evento.x - evento.desdeX) * progreso.t, desdeY + (haciaY - desdeY) * progreso.t),
        onComplete: () => nave.posicionarEn(evento.x, haciaY),
      });
    }
    window.__debug!.fantasmas = fantasmas;
    publicarFantasmas(
      fantasmas.map(({ nave }) => ({ nave, texto: `Estaba aquí: ${nombreDeNave(this.controladores, nave)} fue desplazada de este punto.` })),
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
      this.naves[indice].mostrarEscudo(naveEstado.escudoTurnosRestantes ?? 0);
      // arte-siluetas-3: el indicador de nave propia sigue al turno real
      // (this.estado.turno), no a un parpadeo de animación -- se recalcula
      // en cada refresco para que nunca quede marcada la nave equivocada
      // tras un cambio de turno.
      this.naves[indice].marcarActiva(indice === this.estado.turno);
    }
  }

  private refrescarDebugNaves(): void {
    window.__debug!.naves = this.estado.naves.map((nave, indice) => ({
      id: indice as 0 | 1,
      x: nave.x,
      y: nave.y ?? alturaSuperficie(this.estado.mascara, nave.x) ?? this.estado.mundo.alto - 1,
      integridad: nave.integridad,
      nivelDanio: this.naves[indice].obtenerNivelDanio(),
      hashSilueta: this.naves[indice].obtenerHashSilueta(),
      activa: this.naves[indice].estaActiva(),
      escudo: this.naves[indice].obtenerEscudoTurnos(),
      silueta: this.naves[indice].obtenerVariante(),
      colorAsiento: colorDeAsiento(indice),
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
    const asiento = this.esHumano(this.estado.turno) ? this.estado.turno : (this.ultimoHumano ?? ID_JUGADOR);
    publicarEscudoPropio(this.estado.naves[asiento]?.escudoTurnosRestantes ?? 0);
    if (this.estado.modo !== "presupuesto") {
      publicarEconomia(null);
      window.__debug!.saldo = null;
      return;
    }
    // Durante el turno de la IA el HUD sigue mostrando al último humano.
    const turno = this.estado.turno;
    const id = this.esHumano(turno) ? turno : (this.ultimoHumano ?? ID_JUGADOR);
    const saldo = this.estado.saldos?.[id] ?? 0;
    publicarEconomia(saldo);
    window.__debug!.saldo = saldo;
    window.__debug!.saldos = this.estado.saldos?.map((valor) => valor ?? null);
  }

  private retirarRobotsDetonados(estadoDespues: EstadoPartida): void {
    this.dibujarRobots(estadoDespues.robots ?? []);
    window.__debug!.robots = (estadoDespues.robots ?? []).map((robot) => ({ dueno: robot.dueno, planetaId: robot.planetaId, x: robot.x, y: robot.y, saltos: robot.saltos }));
  }

  // minirobot (rob-2): el robot se dibuja en el lienzo con su contador, y el
  // mismo texto sube al HUD. Se redibuja entero tras cada turno: son como
  // mucho unos pocos y el estado del núcleo es la única fuente de verdad.
  private refrescarRobots(): void {
    const robots = this.estado.robots ?? [];
    this.dibujarRobots(robots);
    window.__debug!.robots = robots.map((robot) => ({ dueno: robot.dueno, planetaId: robot.planetaId, x: robot.x, y: robot.y, saltos: robot.saltos }));
    publicarRobots(
      robots.map((robot) => ({
        dueno: robot.dueno,
        saltos: robot.saltos,
        maxSaltos: MAX_SALTOS_ROBOT,
        texto: `${etiquetaMinirobot(nombreDeNave(this.controladores, robot.dueno), this.controladores[robot.dueno]?.tipo === "humano", contarHumanos(this.controladores))}: salto ${robot.saltos}/${MAX_SALTOS_ROBOT}`,
      })),
    );
  }

  private dibujarRobots(robots: readonly EstadoRobot[]): void {
    for (const marca of this.marcasRobot) marca.destroy();
    this.marcasRobot = [];
    for (const robot of robots) {
      const y = alturaRenderNave(robot.y, robot.y);
      const cuerpo = this.add.graphics().setDepth(28);
      cuerpo.fillStyle(0xe8743b, 1).fillCircle(robot.x, y - RADIO_ROBOT_U, RADIO_ROBOT_U);
      cuerpo.lineStyle(3, 0xffffff, 0.9).strokeCircle(robot.x, y - RADIO_ROBOT_U, RADIO_ROBOT_U);
      const contador = this.add
        .text(robot.x, y - 2 * RADIO_ROBOT_U - 4, `${robot.saltos}/${MAX_SALTOS_ROBOT}`, { fontSize: `${TAMANO_TEXTO_FANTASMA_PX}px`, color: "#ffffff" })
        .setOrigin(0.5, 1)
        .setDepth(28);
      this.marcasRobot.push(cuerpo, contador);
    }
  }

  // eventos-objetos: corazón y tormenta se dibujan con su ruta punteada del
  // turno siguiente. Se redibujan enteros tras cada turno: como mucho 2, y el
  // núcleo es la única fuente de verdad (también de la ruta).
  private refrescarObjetos(): void {
    for (const marca of this.marcasObjeto) marca.destroy();
    this.marcasObjeto = [];
    const objetos = this.estado.universo?.objetos ?? [];
    const visibles = objetos.map((objeto) => ({ objeto, ruta: rutaPrevistaObjeto(this.estado, objeto) }));
    for (const { objeto, ruta } of visibles) {
      const color = objeto.tipo === "corazon" ? 0xff4d79 : 0x8a7bd8;
      const puntos = this.add.graphics().setDepth(27);
      puntos.fillStyle(color, 0.8);
      for (let i = SALTO_PUNTEADO_OBJETO; i < ruta.length; i += SALTO_PUNTEADO_OBJETO) puntos.fillCircle(ruta[i].x, ruta[i].y, 3);
      const cuerpo = this.add.graphics().setDepth(29).setPosition(objeto.x, objeto.y);
      dibujarObjetoEvento(cuerpo, objeto.tipo, RADIO_OBJETO_U);
      this.marcasObjeto.push(puntos, cuerpo);
    }
    window.__debug!.objetos = visibles.map(({ objeto, ruta }) => ({
      id: objeto.id,
      tipo: objeto.tipo,
      x: objeto.x,
      y: objeto.y,
      turnosRestantes: objeto.turnosRestantes,
      rutaPrevista: ruta.map((punto) => ({ x: punto.x, y: punto.y })),
    }));
    publicarObjetos(
      objetos.map((objeto) => ({
        id: objeto.id,
        tipo: objeto.tipo,
        texto: objeto.tipo === "corazon" ? "Corazón galáctico: +50 de vida si toca tu nave" : "Tormenta solar: −25 de vida si toca tu nave",
      })),
    );
  }

  private muerteSubitaActivada(parametrosUrl: URLSearchParams): boolean {
    const parametro = parametrosUrl.get("muerte");
    if (parametro === "1") return true;
    if (parametro === "0") return false;
    try {
      return window.localStorage.getItem("muerte-subita:activada") !== "0";
    } catch {
      return true;
    }
  }

  private eventosActivados(parametrosUrl: URLSearchParams): boolean {
    const parametro = parametrosUrl.get("eventos");
    if (parametro === "1") return true;
    if (parametro === "0") return false;
    try {
      return window.localStorage.getItem("universo:eventos") !== "0";
    } catch {
      return true;
    }
  }

  // eventos-universo: el pronóstico sale del calendario ya sorteado (nunca
  // miente) y el cartel de los eventos que acaba de devolver el núcleo.
  private refrescarUniverso(eventos: readonly EventoSimulacion[]): void {
    this.refrescarHalos();
    const ronda = this.estado.ronda;
    window.__debug!.ronda = ronda;
    const drenaje = ronda === undefined ? 0 : drenajeDeRonda(ronda);
    publicarMuerteSubita(
      ronda === undefined || this.estado.resultado.tipo === "terminada"
        ? null
        : drenaje > 0
          ? `Muerte súbita: −${drenaje} de vida por ronda`
          : ronda === RONDA_MUERTE_SUBITA - 1
            ? "Muerte súbita en 1 ronda"
            : null,
    );
    for (const evento of eventos) {
      if (evento.tipo === "muerte-subita" && evento.fase === "drenaje") publicarCartel(`Muerte súbita: −${evento.danio} de vida a todas`);
    }
    const universo = this.estado.universo;
    window.__debug!.proximoEvento = universo ? { ...universo.proximo } : null;
    window.__debug!.efectos = universo ? universo.efectos.map((efecto) => ({ ...efecto })) : [];
    if (universo === undefined || this.estado.resultado.tipo === "terminada") {
      publicarPronostico(null);
    } else {
      const { enTurnos, tipo, afectado } = universo.proximo;
      const definicion = buscarEvento(tipo);
      const quien = definicion.alcance === "nave" ? ` · ${nombreDeNave(this.controladores, afectado)}` : "";
      publicarPronostico(enTurnos > 1 ? `Próximo evento en ${enTurnos} turnos` : `Próximo evento en 1 turno: ${definicion.nombre}${quien}`);
    }
    for (const evento of eventos) {
      if (evento.tipo !== "evento-universo" || evento.perdido === true) continue;
      const definicion = buscarEvento(evento.evento);
      const quien = definicion.alcance === "nave" ? ` · ${nombreDeNave(this.controladores, evento.nave)}` : "";
      publicarCartel(`${definicion.nombre}${quien}`);
    }
  }

  // Los halos de gravedad salen de la masa del registro: se vuelven a pintar
  // solo cuando esa masa cambia (gravedad ×2/÷2, agujero negro que aparece o
  // expira), no en cada turno. La textura es la misma, así que `bakes` sigue
  // contando el horneado inicial y `rehornoHalos` cuenta los posteriores.
  private refrescarHalos(): void {
    const planetas = this.estado.planetas;
    if (planetas === undefined || this.semillaFondo === undefined) return;
    const firma = firmaDeHalos(planetas);
    if (firma === this.firmaHalos) return;
    this.firmaHalos = firma;
    // Un pozo que aparece a mitad de partida (agujero negro) nace con su masa fija.
    planetas.forEach((planeta) => {
      if (!this.masasReferencia.has(planeta.id)) this.masasReferencia.set(planeta.id, masaPlaneta(planeta));
    });
    const halos = rehornearFondoEspacial(this, this.semillaFondo, MUNDO_ANCHO, MUNDO_ALTO, "fondo-espacial", planetas, this.masasReferencia);
    if (window.__debug !== undefined) window.__debug.halos = halos;
    const depuracion = window.__debug?.fondoEspacial;
    if (depuracion !== undefined) depuracion.rehornoHalos = (depuracion.rehornoHalos ?? 0) + 1;
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
      const { estado, eventos, detonaciones } = jugarTurno(this.estado, fuentes);
      this.aplicarResultadoTurno(estado, eventos, undefined, undefined, { detonaciones });
    }
  }

  // Solución balística exacta (deriva 0) para que quien tiene el turno
  // acierte al rival -- la misma fórmula que usa el intento inicial de la
  // capa de IA. Solo es exacta si el mapa tiene deriva 0 (ver
  // resolverSolucionesBalisticas); con deriva no nula sigue siendo la mejor
  // aproximación disponible sin física real de más.
  private calcularSolucionBalistica(estado: EstadoPartida): { anguloGrados: number; potencia: number } | null {
    const tirador = estado.turno;
    const objetivoId = this.objetivoDe(tirador);
    const naveTiradora = estado.naves[tirador];
    const naveObjetivo = estado.naves[objetivoId];
    const origenX = naveTiradora.x;
    const objetivoX = naveObjetivo.x;
    const origenSuperficie = naveTiradora.y ?? alturaSuperficie(estado.mascara, origenX) ?? estado.mundo.alto - 1;
    const objetivoSuperficie = naveObjetivo.y ?? alturaSuperficie(estado.mascara, objetivoX) ?? estado.mundo.alto - 1;
    const origenCanonY = origenSuperficie - ALTURA_CANON_PX;

    // potencia-dispersion (fix de retorno): resolverSolucionesBalisticas()
    // fijaba SIEMPRE la potencia máxima (su valor por defecto), y avanzar()
    // ahora aplica la dispersión universal a CUALQUIER disparo real -- a
    // potencia máxima es justo donde esa dispersión es mayor (1°, cuadrática
    // con la potencia). Esta solución es solo para tests e2e que no prueban
    // puntería ni dispersión (min-2, min-3, gra-3, nve-3, control-1...): se
    // busca la MENOR potencia que siga teniendo solución, de menor a mayor,
    // para que la dispersión real del disparo quede despreciable y el tiro
    // siga siendo, en la práctica, el impacto garantizado que esos tests dan
    // por hecho. Cae a la potencia máxima si ninguna menor alcanza, igual
    // que antes de este fix.
    for (const fraccionPotencia of [30, 40, 50, 60, 70, 80, 90, 100]) {
      const soluciones = resolverSolucionesBalisticas(
        origenX,
        origenCanonY,
        objetivoX,
        objetivoSuperficie,
        estado.mundo.gravedad,
        velocidadDesdePotencia(fraccionPotencia),
      );
      if (soluciones.length > 0) {
        return soluciones[0];
      }
    }
    return null;
  }

  // imp-11: naves() de referencia para barridoRejilla/resolverDisparo, con
  // la misma derivación de Y que ya usan refrescarDebugNaves y
  // calcularSolucionBalistica.
  private navesParaOraculo(estado: EstadoPartida): readonly NavePosicion[] {
    return estado.naves.map((nave, indice) => ({
      id: indice as IdNave,
      x: nave.x,
      y: nave.y ?? alturaSuperficie(estado.mascara, nave.x) ?? estado.mundo.alto - 1,
      integridad: nave.integridad,
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
    const objetivoId = this.objetivoDe(tirador);
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
      // La colocación garantiza un tiro a quien juega en 0-360°, no en el
      // semicírculo de la IA: con ese rango el oráculo podía no ver el único tiro.
      // Con el paso de 9° de la viabilidad se pierden los tiros de más daño y
      // los e2e que juegan hasta un ganador no lo alcanzaban en 10 rondas:
      // el oráculo barre la vuelta entera con el paso fino de la IA.
      rangoAngulos: RANGO_ANGULOS_ORACULO,
    });
    return candidatos[0] ?? null;
  }

  // imp-11 (solo para tests e2e): disparo de comprobación con daño exacto
  // conocido de antemano contra el MISMO resolutor real (resolverDisparo),
  // no una condición de parada inventada -- así el test puede pedir un tiro
  // que falle a propósito (danio === 0) sin adivinar ángulo/potencia a
  // ciegas ni depender de que ningún planeta se cruce por casualidad.
  //
  // adrian-angulo-360 (corrección): sin incluirDispersionPotencia:true este
  // oráculo predecía sobre un tiro SIN la dispersión que avanzar.ts SIEMPRE
  // aplica al disparo real -- un tiro al borde del radio de efecto que el
  // oráculo daba por fallo (danio 0) podía acabar impactando de verdad, que
  // es justo lo que delató imp-11 (85 vs 86 de integridad esperada).
  private probarDisparoMultipozo(estado: EstadoPartida, anguloGrados: number, potencia: number): { danio: number } {
    const tirador = estado.turno;
    const objetivoId = this.objetivoDe(tirador);
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
      incluirDispersionPotencia: true,
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

      // Gancho de pruebas: en modo presupuesto Despedida se cobra al disparar;
      // sin saldo para pagarla el bucle no podría acotar la partida, así que
      // se repone el saldo justo de quien dispara.
      const { saldos } = this.estado;
      const precioDesenlace = costeArma(buscarArma(ARMA_DESENLACE));
      if (saldos?.[this.estado.turno] !== undefined && saldos[this.estado.turno]! < precioDesenlace) {
        this.estado = { ...this.estado, saldos: saldos.map((saldo, nave) => (nave === this.estado.turno ? precioDesenlace : saldo)) };
      }

      const objetivoId = this.objetivoDe(this.estado.turno);
      // salida-pantalla: la solución balística de suelo llano ignora los pozos
      // del modo espacial, y un tiro que sale del encuadre se pierde sin
      // detonar (sin autodaño), así que el bucle ya no acotaba la partida.
      // Se prueba la solución y después una rejilla hasta dar con un tiro que
      // detone; avanzar() es puro, descartar el intento no deja rastro.
      const solucion = this.calcularSolucionBalistica(this.estado) ?? { anguloGrados: 45, potencia: 70 };
      const candidatos = [solucion];
      for (const potencia of [30, 50, 70, 100]) {
        for (let anguloGrados = 0; anguloGrados <= 180; anguloGrados += 5) {
          candidatos.push({ anguloGrados, potencia });
        }
      }
      let resultado: ReturnType<typeof avanzar> | null = null;
      for (const candidato of candidatos) {
        const intento = avanzar(this.estado, { arma: ARMA_DESENLACE, anguloGrados: candidato.anguloGrados, potencia: candidato.potencia, objetivoId });
        resultado = intento;
        if (!intento.eventos.some((evento) => evento.tipo === "proyectil-perdido")) break;
      }
      const { estado, eventos, categoriaBroma, detonaciones } = resultado!;
      this.aplicarResultadoTurno(estado, eventos, categoriaBroma, ARMA_DESENLACE, { detonaciones });
    }
  }
}
