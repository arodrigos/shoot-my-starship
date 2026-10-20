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
import { avanzar, type ResultadoAvanzar } from "@/sim/partida/avanzar";
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
import { crearProyectil, GRAVEDAD_REFERENCIA_PX_S2, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { contarPixelesDestruidos } from "@/sim/terreno/estadisticas";
import { asignarPremios } from "@/juego/premios/premios";
import { acumularTurno, estadisticasIniciales as estadisticasAsientosIniciales, type EstadisticasAsiento } from "@/juego/premios/estadisticas";
import { estadisticasIniciales, generarParteDeGuerra, type EstadisticasPartida } from "@/sim/partida/parteDeGuerra";
import { buscarMapa, SEMILLA_SISTEMA_POR_DEFECTO } from "@/juego/mundos/mapas";
import { Nave } from "@/juego/naves/Nave";
import { IndicadorDeriva } from "@/juego/deriva/IndicadorDeriva";
import { alfaRotuloDeriva } from "@/juego/deriva/visibilidadDeriva";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { VisualArmas } from "@/juego/armas/VisualArmas";
import { aspectoDeId, aspectosDelCatalogo, trazadoDeArma } from "@/juego/armas/aspecto";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { buscarEquipo, esIdEquipo } from "@/sim/equipo/catalogo";
import { alcancePropulsores, volarConPropulsores } from "@/sim/equipo/propulsores";
import { LA_CONTABLE, ALMIRANTE_BISAGRA, buscarPersonalidad } from "@/sim/ia/personalidades";
import { aplicarNivel, etiquetaNivel, NIVEL_IA_POR_DEFECTO } from "@/sim/ia/nivel";
import { NOMBRES_CORTOS_RIVAL } from "@/juego/textos/nombresEnTexto";
import type { Personalidad } from "@/sim/ia/tipos";
import { UMBRAL_FALLO_PX, UMBRAL_DANIO_SUFICIENTE_POR_TURNO } from "@/sim/ia/decidir";
import { exponerDepuracionDeTerreno } from "@/juego/depuracion/exponerTerreno";
import { MedidorFrames } from "@/juego/rendimiento/medidorFrames";
import { MedidorRespuesta } from "@/juego/rendimiento/medidorRespuesta";
import { ClienteSim } from "@/juego/motor/clienteSim";
import { crearTrabajadorSim } from "@/juego/motor/crearTrabajador";
import { mostrarApuntandoIA, ocultarApuntandoIA } from "@/juego/hud/indicadorApuntandoIA";
import { montarHudRendimiento } from "@/juego/rendimiento/hudRendimiento";
import { limpiarLatenciasApuntado, registrarLatenciaApuntado, registrarLatenciaCamara, registrarLatenciaDisparo, registrarLatenciaRastro, registrarLatenciaRelojTurno, ultimasLatenciasApuntado } from "@/juego/rendimiento/latenciasApuntado";
import { observarTareasLargas, reiniciarTareasLargas, tareasLargasActuales } from "@/juego/rendimiento/tareasLargas";
import { mostrarCalculandoTurno, ocultarCalculandoTurno } from "@/juego/hud/indicadorCalculandoTurno";
import {
  fijarModo,
  fijarModoEspacial,
  obtenerEstadoControl,
  publicarDisparoJugadorResuelto,
  publicarJugable,
  publicarPropulsoresBloqueados,
  solicitarDisparoAutomatico,
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
import { avanzarGestoPolar, iniciarGestoPolar, type GestoPolar } from "@/juego/control/apuntado";
import { mundoAPantallaCss, pantallaCssAMundo } from "@/juego/camara/conversion";
import { ControladorCamara, type InstantaneaCamara } from "@/juego/camara/controladorCamara";
import { cerrarAyudaCamara, publicarCamaraManual, registrarManejadorVerTodo, reiniciarCamaraHud } from "@/juego/control/camaraStore";
import { cortarPorLongitudPantalla, geometriaTrayectoria, longitudDeArco, type GeometriaTrayectoria, type PuntoPantalla } from "@/juego/mira/trayectoriaPantalla";
import { limpiarReaccion, publicarReaccion, registrarManejadorRepeticion } from "@/juego/control/reaccion";
import { limpiarParteDeGuerra, publicarParteDeGuerra } from "@/juego/control/parteDeGuerraStore";
import { publicarResultadoTurno, reiniciarResultadoTurno } from "@/juego/control/resultadoTurnoStore";
import { vozDeNave } from "@/contenido/bancoBromas";
import { anuncioDeEvento, anuncioMuerteSubitaAviso, anuncioMuerteSubitaDrenaje, textoLocutado, type AnuncioEvento } from "@/contenido/anunciosEventos";
import {
  memoriaIAInicial,
  nombreDeNave,
  sanearNombre,
  type Controlador,
  type JugadorConfig,
  type MemoriaIA,
} from "@/juego/jugadores";
import { contarHumanos, etiquetaMinirobot } from "@/juego/textosPartida";
import { publicarGanador, publicarParticipantes, publicarRivalesIA, reiniciarParticipantes } from "@/juego/control/participantesStore";
import type { CategoriaBroma } from "@/sim/partida/categoriaBroma";
import { MEMORIA_PLANTILLAS, resumenPartida, tocaResumen } from "@/sim/partida/resumenPartida";
import { COLORES_NAVE, colorDeAsiento } from "@/juego/naves/paletaNaves";
import { contornoSiluetaAsiento, varianteSiluetaAsiento } from "@/juego/naves/siluetaAsiento";
import { inyectarHistorico, publicarAnuncioHistorico, publicarResumen, reiniciarBromas } from "@/juego/control/broma";
import { cerrarRelevo, publicarRelevo, registrarManejadorRelevo, reiniciarRelevo } from "@/juego/control/relevoStore";
import { FantasmaNave } from "@/juego/naves/FantasmaNave";
import { publicarFantasmas } from "@/juego/control/fantasmasStore";
import { publicarObjetos } from "@/juego/control/objetosStore";
import { publicarRobots } from "@/juego/control/robotsStore";
import { dibujarObjetoEvento } from "@/juego/efectos/dibujarObjetoEvento";
import { RONDAS_DE_VIDA_OBJETO, rutaPrevistaObjeto, VIDA_CORAZON, VIDA_TORMENTA } from "@/sim/universo/objetos";
import { publicarCartel, publicarMuerteSubita, publicarPronostico, reiniciarUniverso } from "@/juego/control/universoStore";
import { buscarEvento } from "@/sim/universo/catalogoEventos";
import { aplicarEvento, conUniverso } from "@/sim/universo/efectos";
import { EfectosEventos, type DatosEventos } from "@/juego/efectos/eventos/EfectosEventos";
import type { TipoEvento } from "@/sim/universo/tipos";
import { conMuerteSubita, drenajeDeRonda, RONDA_MUERTE_SUBITA } from "@/sim/partida/muerteSubita";
import { duracionPropulsoresMs, duracionSaltosMs, easeInOut, longitudDeRuta, muestraDeSalto, puntoDelRecorrido } from "@/juego/vuelo/ritmo";
import { MAX_SALTOS_ROBOT, type EstadoRobot } from "@/sim/armas/minirobot";
import { publicarIntegridad, reiniciarIntegridad } from "@/juego/control/integridadStore";
import { guardarUltimaPartida } from "@/juego/control/progreso";
import { crearSelectorFrases, type SelectorFrases } from "@/contenido/selectorFrases";
import { obtenerLocutor } from "@/juego/audio/voz";
import { actualizarTension, desbloquearAudio, estadoAudioActual, reiniciarTension, pausarAudio, reanudarAudio, reproducirEfecto, reproducirTono } from "@/juego/audio/motor";
import { indiceTic } from "@/juego/audio/cadenciaTicTac";
import type { DatosEscenaPartida } from "@/juego/main";
import { GuardadorPartida } from "@/juego/partidaGuardada/guardador";
import { guardadoActivado } from "@/juego/partidaGuardada/almacen";
import { mostrarAvisoSinGuardado, reiniciarAvisoSinGuardado } from "@/juego/control/avisoSinGuardadoStore";
import type { DatosPartida } from "@/juego/partidaGuardada/tipos";
import { comprobarCantidadDentroDelTecho, crearEmisorRegistrado } from "@/juego/efectos/crearEmisorRegistrado";
import { ExplosionPorCapas, fasesActivasEn } from "@/juego/efectos/ExplosionPorCapas";
import { reproducirDetonaciones } from "@/juego/efectos/reproductorDetonaciones";
import type { Detonacion } from "@/sim/partida/detonaciones";
import { permiteMovimientoCamara } from "@/juego/efectos/movimientoCamara";
import { ControladorRemate, decidirRemate, type FotogramaRemate, type ModoRemate } from "@/juego/efectos/remate";
import { amplitudSacudida, DURACION_SACUDIDA_IMPACTO_MS, intensidadDestelloDanio } from "@/juego/efectos/realceImpacto";
import { esComportamientoAdherente, insumoPerturbacionErratica, pasosDeMecha } from "@/sim/fisica/comportamientoExtendido";
import { PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS, superaPresupuestoAbanico, type AbanicoPrevisualizacion, type BandaPrevisualizacion } from "@/sim/armas/previsualizacion";
import { ocultarMira, tocaReintentarMira, type MiraOculta } from "@/juego/mira/miraOculta";
import { limpiarCuentaAtras, publicarCuentaAtras } from "@/juego/control/cuentaAtrasStore";
import {
  adelantarRelojTurno,
  arrancarRelojTurno,
  configurarRelojTurno,
  mostrarAvisoTiempo,
  obtenerRelojTurno,
  pararRelojTurno,
  pausarRelojTurno,
  reanudarRelojTurno,
  registrarAlAgotarseReloj,
  reiniciarRelojTurno,
  tickRelojTurno,
} from "@/juego/control/relojTurnoStore";
import { esHumanoLocalUnico, nombreEnResumen, textoDesplazamiento } from "@/juego/textos/nombresEnTexto";
import { guionResumenPrueba } from "@/juego/textos/guionesResumen";
import { dibujarRastro } from "@/juego/rastro/DibujoRastro";
import { ESTADO_RASTROS_VACIO, registrarRastro, rastroVisible, ALFA_RASTRO, type EstadoRastros } from "@/juego/rastro/rastros";
import { ContadorAdherencia } from "@/juego/vuelo/ContadorAdherencia";
import type { DebugEfectoVisible, UltimoTurnoMedido } from "@/debug/tipos";
import "@/debug/tipos";
import { INTEGRIDAD_MAXIMA } from "@/sim/naves/vida";

// cat-2: el haz del Rayo Láser se ve al menos esto antes de apagarse.
// Holgura entre el vértice de la solución de depuración y el borde superior.
const MARGEN_VERTICE_SOLUCION_PX = 40;
// Por debajo de esta distancia al origen, la ruta de propulsores no es un
// movimiento: la nave apunta contra la superficie y no llegaría a salir.
const DISTANCIA_MINIMA_PROPULSORES_PX = 12;

const DURACION_HAZ_MS = 450;

// desplazamiento-tras-impacto (des-3): el deslizamiento dura entre 300 y 600 ms.
const DURACION_DESLIZAMIENTO_MS = 500;
const RADIO_MARCA_FANTASMA_U = 22;
const TAMANO_TEXTO_FANTASMA_PX = 34;
const RADIO_ROBOT_U = 14;
// salida-pantalla: cuánto se queda el aviso «¡Perdido!» en pantalla.
const DURACION_AVISO_PERDIDO_MS = 1200;
// vida-color: el número de daño sube y se funde en este tiempo.
const DURACION_NUMERO_DANIO_MS = 900;
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
const VIDA_BASE_TOPE_DESENLACE = 100;

// gravedad-visible (grav-vis-3, corrección): grosor de la mira en píxeles
// de PANTALLA, no de mundo -- ver actualizarPrevisualizacion().
const ANCHO_MIRA_CSS_PX = 3;
// Tramo de una polilínea entre dos longitudes de arco: parte del punto exacto
// donde acaba el primer corte, para que el abanico ancho empiece donde acaba el
// estrecho.
function tramoEntre(puntos: readonly PuntoPantalla[], desde: number, hasta: number): PuntoPantalla[] {
  const a = cortarPorLongitudPantalla(puntos, desde);
  const b = cortarPorLongitudPantalla(puntos, hasta);
  return [a[a.length - 1], ...b.slice(a.length)];
}
const ANCHO_BORDE_ABANICO_CSS_PX = 1.5;
const COLOR_ABANICO_TRAMO1 = 0xffb347;
const COLOR_ABANICO_TRAMO2 = 0xffd9a0;
const COLOR_BORDE_ABANICO = 0xffd9a0;

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
const TOPE_PARTICULAS_ESTELA_LLAMA = 16;

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
// cargarEscenario: el planeta cuya superficie queda más cerca del punto.
function planetaMasCercano(planetas: EstadoPartida["planetas"], x: number, y: number): number {
  let mejor = 0;
  let distanciaMejor = Infinity;
  for (const planeta of planetas ?? []) {
    const distancia = Math.abs(Math.hypot(x - planeta.cx, y - planeta.cy) - planeta.radio);
    if (distancia < distanciaMejor) {
      distanciaMejor = distancia;
      mejor = planeta.id;
    }
  }
  return mejor;
}

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

function callarVoz(): void {
  obtenerLocutor().callar();
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
  // partida-guardada: una instantánea por partida, escrita al cerrar cada turno.
  private guardador = new GuardadorPartida(() => mostrarAvisoSinGuardado());
  private jugadoresPartida: readonly JugadorConfig[] = [];
  private mapaIdPartida: string | null = null;
  private semillaSistemaPartida: number | null = null;
  private cancelarManejadorRelevo: (() => void) | null = null;
  // reloj-turno: turno en el que ya arrancó (o se agotó) el reloj, para que
  // volver de pestaña oculta o un frame más no lo rearranque ni dispare dos
  // veces; el tirador al que se le acabó el tiempo, para el resumen del relevo.
  private claveTurnoReloj: string | null = null;
  private turnoSinTiempo: IdNave | null = null;
  private temporizadorReloj: number | null = null;
  private cancelarAlAgotarseReloj: (() => void) | null = null;
  private pausadaPorOculta = false;
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
  // fantasma: una entrada por nave muerta, hasta el final de la partida.
  private fantasmasNave = new Map<number, FantasmaNave>();
  private marcasRobot: Phaser.GameObjects.GameObject[] = [];
  private marcasObjeto: Phaser.GameObjects.GameObject[] = [];
  private indicadorDeriva!: IndicadorDeriva;
  // Reloj del rótulo de deriva. Phaser recorta el delta a 200 ms por fotograma,
  // así que con WebGL por software (pocos fps) el delta de la escena corre
  // mucho más despacio que el reloj real y los 4 s duraban medio minuto. Se
  // mide el tiempo real entre fotogramas, con tope de 1 s para que una
  // pestaña que estuvo en segundo plano no se coma el rótulo de golpe.
  private msTableroVisible = 0;
  private instanteAnteriorRotulo: number | null = null;
  private ayudaInicialVista = false;
  private alfaRotulo = 1;
  private animador!: AnimadorProyectil;
  // realce-impacto (rlc-1): avance de turno retrasado mientras dura la
  // sacudida de cámara, contado a mano con el mismo `delta` del bucle de
  // update() -- NUNCA this.time.delayedCall, porque dispararRafagaTurbo
  // (proy-4, proy-5, hum-1) avanza turnos con un bucle síncrono que llama a
  // this.update() a mano sin que corra el bucle real de Phaser por debajo:
  // un delayedCall ahí se quedaría pendiente para siempre.
  // ritmo-robot-propulsores: reproducciones largas (propulsores, saltos del
  // robot) movidas por el delta de update() y no por tweens, para que la ráfaga
  // turbo las avance igual que el bucle real. Mientras haya alguna, el turno
  // siguiente espera.
  private movimientos: { transcurridoMs: number; readonly duracionMs: number; readonly aplicar: (ms: number) => void; readonly terminar: () => void }[] = [];
  private alTerminarMovimientos: (() => void) | null = null;
  private avanceTurnoPendiente: { restanteMs: number; avanzar: () => void } | null = null;
  // remate-impacto: `bloquea` es true en el remate completo (el turno espera a
  // su fin) y false en el de solo destello, que no retrasa nada.
  private remate: { readonly ctl: ControladorRemate; readonly bloquea: boolean; readonly alTerminar: () => void; congelado: boolean } | null = null;
  private veloRemate: Phaser.GameObjects.Rectangle | null = null;
  private encuadreGuardadoRemate: InstantaneaCamara | null = null;
  // camara-gestos: único dueño de la cámara principal; el resto de la escena
  // le pide encuadres en vez de tocarla.
  private camaraCtl!: ControladorCamara;
  // Punteros que han caído sobre el lienzo, con su última posición: con dos
  // es pellizco/arrastre, con uno apunta.
  private readonly punterosLienzo = new Map<number, { x: number; y: number }>();
  private ajusteAlApoyar: { anguloGrados: number; potencia: number } | null = null;
  private marcaCamaraPendiente: { marca: string; nombre: "gesto-camara" | "ver-todo" } | null = null;
  private contadorMarcasCamara = 0;
  private cancelarCamara: (() => void) | null = null;
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
  // voz-resumenes: el locutor de partida habla cada TURNOS_ENTRE_RESUMENES
  // turnos resueltos, de cualquier asiento.
  private semillaResumenes = 0;
  private turnosResueltos = 0;
  private plantillasRecientes: string[] = [];
  private fallosSeguidos: number[] = [];
  // Estadísticas reales por nave (humor-7): se acumulan turno a turno, nunca
  // se recalculan a posteriori, para que el parte de guerra final describa
  // exactamente lo que pasó y no una aproximación.
  // multi-setup-partida: misma generalización que this.naves -- paralela a
  // this.estado.naves, de 2 a 4 posiciones.
  private estadisticas!: EstadisticasPartida[];
  // premios-calculo: estadísticas por asiento para los premios del parte. No
  // se persisten (los premios no se guardan entre partidas), así que al
  // reanudar una partida guardada empiezan a cero.
  private estadisticasAsientos!: EstadisticasAsiento[];
  // Trayectoria animada del vuelo del turno en curso; solo la fija el turno
  // animado real, para que los guiones sin vuelo no reutilicen una vieja.
  private trayectoriaDelTurno: readonly { x: number; y: number }[] | null = null;
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
  // vida-color: efectos del turno (explosiones, haz) y números de daño aún vivos.
  private efectosDelTurno: readonly DebugEfectoVisible[] = [];
  private efectosEventos!: EfectosEventos;
  private numerosDanioVivos: DebugEfectoVisible[] = [];
  // avi-1: el único «¡Perdido!» vivo; el siguiente destruye este antes de pintarse.
  private avisoPerdidoVivo: { texto: Phaser.GameObjects.Text; temporizador: Phaser.Time.TimerEvent } | null = null;
  // paron-explosion: medición permanente de frames, de solo lectura.
  private readonly medidorFrames = new MedidorFrames();
  private readonly medidorRespuesta = new MedidorRespuesta();
  // respuesta-200ms: la simulación pesada vive fuera del hilo principal.
  private readonly motor = new ClienteSim(crearTrabajadorSim());
  // Hay una petición al motor cuyo resultado aún no se ha aplicado: el turno no
  // es jugable y no se admite otro disparo hasta que vuelva.
  private solicitudEnCurso = false;
  // respuesta-disparo: coste por fases del último turno de disparo (lo lee __debug.motor).
  private ultimoTurnoMedido: UltimoTurnoMedido | null = null;
  // Temporizador de la píldora «Calculando el turno…», armado al terminar la animación del impacto.
  private temporizadorCalculando: ReturnType<typeof setTimeout> | null = null;
  private previsEnCurso = false;
  private previsClave = "";
  private previsEstadoPedido: EstadoPartida | null = null;
  private previsPendiente: { peticion: Parameters<ClienteSim["previsualizar"]>[0]; estado: EstadoPartida } | null = null;
  private previsVigente: { estado: EstadoPartida; banda: BandaPrevisualizacion; abanico?: AbanicoPrevisualizacion; duracionMs: number } | null = null;
  // mira-oculta-timeouts: mientras la mira está oculta por presupuesto no se
  // recalcula con cada movimiento del apuntado; ver miraOculta.ts.
  private miraOculta: (MiraOculta & { readonly estado: EstadoPartida }) | null = null;
  // Coste que las pruebas suman al cómputo para ocultar la mira con el mismo
  // camino de siempre, sin depender de que la CPU del CI vaya lenta.
  private costeMiraForzadoMs = 0;
  private calculosPrevisualizacion = 0;
  // proy-4: estela de pool ACOTADO -- maxParticles en la config del emisor
  // (no un contador propio) es lo que garantiza el tope, así que
  // getAliveParticleCount() nunca puede superarlo, también con varios vuelos
  // seguidos sin que el pool "en reposo" entre turnos crezca.
  private emisorEstela!: Phaser.GameObjects.Particles.ParticleEmitter;
  // armas-aspecto: estela aditiva de las armas con llama y capa de textura.
  private emisorEstelaLlama!: Phaser.GameObjects.Particles.ParticleEmitter;
  private visualArmas!: VisualArmas;
  // prevision-real: se dibuja en coordenadas de MUNDO (como la estela, no
  // como IndicadorDeriva, que es HUD de pantalla) -- misma convención que
  // "dibujados en el mundo y no en un recuadro" del diseño.
  private graficosPrevisualizacion!: Phaser.GameObjects.Graphics;
  // rastro-ultimo-disparo: capa propia por debajo de la mira y el único rastro
  // de la escena; rastroPintado evita redibujar cada frame.
  private graficosRastro!: Phaser.GameObjects.Graphics;
  private rastros: EstadoRastros = ESTADO_RASTROS_VACIO;
  private rastroPintado: { rastro: EstadoRastros["ultimo"]; activo: boolean } | null = null;
  private cancelarManejadorDisparo: (() => void) | null = null;
  private cancelarManejadorRepeticion: (() => void) | null = null;

  private readonly manejarPointerDown = (evento: PointerEvent): void => this.alPointerDown(evento);
  private readonly manejarPointerMove = (evento: PointerEvent): void => this.alPointerMove(evento);
  private readonly manejarPointerFin = (evento: PointerEvent): void => this.alPointerFin(evento);
  // apuntado-y-relevo: id del puntero que arrastra sobre el lienzo (null si
  // ninguno). Un segundo dedo o un arrastre que empezó en la consola no
  // mueven el apuntado.
  private punteroApuntando: number | null = null;
  // apuntado-dedo: gesto relativo en curso, último punto del dedo (para
  // pintar la flecha sin tapar la etiqueta) y marca de la última interacción
  // aún sin medir hasta su primer frame.
  private gestoApuntado: GestoPolar | null = null;
  private dedoApuntado: { x: number; y: number } | null = null;
  private marcaApuntadoPendiente: string | null = null;
  private contadorMarcasApuntado = 0;
  private graficosFlecha!: Phaser.GameObjects.Graphics;
  private etiquetaFlecha!: Phaser.GameObjects.Text;

  constructor() {
    super("Partida");
  }

  // Recibida de game.scene.add(key, Partida, true, datos) en main.ts. El
  // parámetro de URL ?mapa= sigue teniendo la última palabra sobre
  // datosEscena.mapaId: lo usan los tests e2e de bloques anteriores a
  // partida-completa (render-6, control-1...) que navegan directo con un
  // mapa concreto sin pasar por la pantalla de inicio.
  init(data: DatosEscenaPartida = {}): void {
    const guardado = data.reanudar;
    if (!guardado) {
      this.datosEscena = data;
      return;
    }
    // Reanudar: la instantánea manda sobre cualquier otro dato de arranque.
    const { config } = guardado;
    const primeraIA = config.jugadores.find((jugador) => jugador.tipo === "ia");
    this.datosEscena = {
      reanudar: guardado,
      mapaId: config.mapaId ?? undefined,
      semillaSistema: config.semillaSistema ?? undefined,
      modo: config.modo,
      todosVemosTodo: config.todosVemosTodo,
      relojTurnoS: config.relojTurnoS ?? undefined,
      personalidadId: primeraIA?.personalidadId,
      nivelIA: primeraIA?.nivel,
      ...(config.clasica ? {} : { jugadores: config.jugadores }),
    };
  }

  create(): void {
    window.__debug = window.__debug ?? {};
    this.movimientos = [];
    this.alTerminarMovimientos = null;
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
    reiniciarRelojTurno();
    reiniciarAvisoSinGuardado();
    configurarRelojTurno(this.datosEscena.relojTurnoS ?? null);
    this.claveTurnoReloj = null;
    this.turnoSinTiempo = null;
    this.pausadaPorOculta = false;
    this.relevoPendiente = false;
    this.ultimoHumano = null;
    window.__debug.eliminadas = [];
    window.__debug.ganador = undefined;
    this.memoriaIA = new Map();
    this.guardador = new GuardadorPartida(() => mostrarAvisoSinGuardado());

    const reanudar = this.datosEscena.reanudar ?? null;
    const parametrosUrl = new URLSearchParams(window.location.search);
    // Al reanudar, la URL (?mapa=) no puede cambiar el mundo guardado.
    const idMapa = reanudar ? this.datosEscena.mapaId : (parametrosUrl.get("mapa") ?? this.datosEscena.mapaId);
    const personalidadBase = this.datosEscena.personalidadId ? buscarPersonalidad(this.datosEscena.personalidadId) : RIVAL_POR_DEFECTO;
    // multi-setup-partida: sin `jugadores` (atajo ?mapa=, tests de bloques
    // anteriores) la partida es la de siempre: un humano contra la IA elegida.
    const jugadores: readonly JugadorConfig[] = this.datosEscena.jugadores ?? [
      { nombre: "Tú", tipo: "humano" },
      { nombre: personalidadBase.nombre, tipo: "ia", personalidadId: personalidadBase.id, nivel: this.datosEscena.nivelIA },
    ];
    this.jugadoresPartida = jugadores;
    this.controladores = jugadores.map((jugador, indice) => {
      const nivel = jugador.tipo === "ia" ? (jugador.nivel ?? NIVEL_IA_POR_DEFECTO) : null;
      const personalidad =
        jugador.tipo === "ia" ? (jugador.personalidadId ? buscarPersonalidad(jugador.personalidadId) : personalidadBase) : null;
      return {
      tipo: jugador.tipo,
      // Los nombres de las IA son fijos y salen de la personalidad: acotarlos
      // a 16 letras los convertía en «Almirante Bisagr» antes de llegar al HUD.
      nombre: jugador.tipo === "ia" ? jugador.nombre : sanearNombre(jugador.nombre, `Nave ${indice + 1}`),
      // El nivel se aplica aquí, una sola vez: de aquí en adelante la IA (en
      // el Worker o en línea) solo ve la personalidad ya transformada.
      personalidad: personalidad !== null && nivel !== null ? aplicarNivel(personalidad, nivel) : null,
      nivel,
      };
    });
    this.rival = this.controladores.find((controlador) => controlador.personalidad !== null)?.personalidad ?? personalidadBase;
    // hud-canales-1: una sola vez por partida, para el canal de estado.
    publicarNombreRival(this.rival.nombre);
    publicarParticipantes(
      this.datosEscena.jugadores
        ? this.controladores.map((controlador) => ({ nombre: controlador.nombre, esHumano: controlador.tipo === "humano" }))
        : null,
    );
    const cantidadNaves = this.controladores.length;
    window.__debug.controladores = this.controladores.map((controlador) => ({
      tipo: controlador.tipo,
      nombre: controlador.nombre,
      ...(controlador.personalidad && controlador.nivel ? { nivel: controlador.nivel, error: controlador.personalidad.error } : {}),
    }));
    publicarRivalesIA(
      this.controladores.map((controlador) =>
        controlador.personalidad && controlador.nivel
          ? { nombreCorto: NOMBRES_CORTOS_RIVAL[controlador.personalidad.id] ?? controlador.personalidad.nombre, nivel: controlador.nivel, etiquetaNivel: etiquetaNivel(controlador.nivel) }
          : null,
      ),
    );

    // modos-y-presupuesto: ?modo= sigue la misma convención que ?mapa=/
    // ?semilla= -- atajo determinista para los tests e2e, con la última
    // palabra sobre datosEscena.modo. ?saldo= fija el presupuesto de la ronda
    // para que un e2e pueda probar el saldo 0 sin gastarlo eligiendo armas.
    const modoParam = reanudar ? null : parametrosUrl.get("modo");
    const modo: ModoJuego = modoParam === "presupuesto" ? "presupuesto" : modoParam === "barra-libre" ? "barra-libre" : (this.datosEscena.modo ?? "barra-libre");
    const saldoParam = reanudar ? null : parametrosUrl.get("saldo");
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

      const mascara = reanudar ? reanudar.estado.mascara : generarMascara(mapa.semillaTerreno, MUNDO_ANCHO, MUNDO_ALTO);
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
      this.estado = reanudar
        ? reanudar.estado
        : {
            ...crearPartidaInicial(mundoAjustado, mascara, xNaves, mapa.semillaPartida),
            modo,
            ...(saldoInicial !== undefined ? this.economiaInicial(saldoInicial) : {}),
          };
      this.mapaIdPartida = idMapa;
      this.semillaSistemaPartida = null;

      const { terreno } = crearTerrenoPhaser(this, mascara, "terreno-partida", mapa.paleta);
      this.terreno = terreno;
      this.selectorFrases = crearSelectorFrases(mapa.semillaPartida);
      this.semillaResumenes = mapa.semillaPartida;
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
      this.mapaIdPartida = null;
      this.semillaSistemaPartida = semillaSistema;
      const mundoEspacial: ParametrosMundo = reanudar ? reanudar.estado.mundo : {
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
      const colocacion = reanudar ? null : colocarNaves(semillaSistema, mundoEspacial, crearEstadoAleatorio(semillaSistema), cantidadNaves, this.controladores.map((controlador) => controlador.tipo === "ia"));
      const sistema = colocacion ? colocacion.sistema : { mascara: reanudar!.estado.mascara, planetas: reanudar!.estado.planetas ?? [] };
      this.estado = reanudar ? reanudar.estado : {
        version: 1,
        mundo: mundoEspacial,
        mascara: sistema.mascara,
        naves: colocacion!.naves,
        ordenTurno: colocacion!.naves.map((_nave, id) => id),
        turno: 0,
        numeroTurno: 0,
        aleatorio: colocacion!.aleatorio,
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
      this.semillaResumenes = semillaSistema;
    }

    const texturaCanvas = this.textures.get("terreno-partida") as Phaser.Textures.CanvasTexture;
    exponerDepuracionDeTerreno(this.terreno, texturaCanvas);
    window.__debug.terreno!.listo = true;

    // eventos-universo: activo por defecto; `eventos=0` en la URL (o la clave
    // guardada «universo:eventos» a «0», que es como el e2e lo apaga en bloque)
    // lo desactiva, y `eventos=1` fuerza encenderlo.
    reiniciarUniverso();
    this.efectosEventos?.destruir();
    this.efectosEventos = new EfectosEventos(this, {
      reducido: prefiereMovimientoReducido,
      sacudidaActiva: () => obtenerEstadoControl().sacudidaActiva,
      sacudir: (duracionMs, intensidad) => this.sacudirCamara(duracionMs, intensidad),
      alCambiar: () => this.publicarEfectosVisibles(),
    });
    if (!reanudar && this.eventosActivados(parametrosUrl)) this.estado = conUniverso(this.estado);
    // muerte-subita: activa por defecto; `muerte=0` en la URL o la clave
    // guardada «muerte-subita:activada» a «0» (como el e2e la apaga en bloque)
    // la desactiva, y `muerte=1` fuerza encenderla.
    if (!reanudar && this.muerteSubitaActivada(parametrosUrl)) this.estado = conMuerteSubita(this.estado);
    window.__debug.fijarMuerteSubita = ({ ronda, integridades }) => {
      this.estado = {
        ...conMuerteSubita(this.estado, ronda),
        ...(integridades ? { naves: this.estado.naves.map((nave, id) => ({ ...nave, integridad: integridades[id] ?? nave.integridad })) } : {}),
      };
      this.refrescarNaves();
      this.refrescarUniverso([]);
      this.publicarTension();
    };
    window.__debug.cargarEscenario = (escenario) => {
      const turno = this.estado.ordenTurno.find((id) => this.esHumano(id)) ?? this.estado.turno;
      this.estado = {
        ...(escenario.ronda === undefined ? this.estado : conMuerteSubita(this.estado, escenario.ronda)),
        turno,
        naves: this.estado.naves.map((nave, id) => {
          const dado = escenario.naves[id];
          return dado ? { ...nave, x: dado.x, y: dado.y, integridad: dado.integridad } : nave;
        }),
      };
      if (escenario.robots) {
        const rival = this.estado.naves.findIndex((_nave, id) => id !== turno);
        this.estado = {
          ...this.estado,
          robots: escenario.robots.map((dado) => ({
            dueno: dado.dueno,
            objetivoId: dado.dueno === turno ? rival : turno,
            armaId: "minirobot-saltaplanetas",
            planetaId: planetaMasCercano(this.estado.planetas, dado.x, dado.y),
            x: dado.x,
            y: dado.y,
            saltos: 0,
          })),
        };
        this.refrescarRobots();
      }
      seleccionarArma(escenario.arma);
      fijarApuntadoDirecto(escenario.anguloGrados, escenario.potencia);
      this.camaraCtl.alCambiarTurno();
      publicarTurno(turno);
      this.refrescarNaves();
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
    window.__debug.forzarEvento = (tipo, afectado = 1) => {
      if (this.estado.universo === undefined) return;
      const aplicado = aplicarEvento(this.estado, { enTurnos: 0, tipo, afectado }, "calendario");
      this.estado = aplicado.estado;
      this.refrescarNaves();
      this.terreno.sincronizarDesde(this.estado.mascara);
      this.refrescarObjetos();
      this.refrescarUniverso(aplicado.eventos);
    };
    window.__debug.fijarProximoEvento = (proximo) => {
      const universo = this.estado.universo;
      if (universo === undefined) return;
      this.estado = { ...this.estado, universo: { ...universo, proximo } };
      this.refrescarUniverso([]);
    };
    this.refrescarUniverso([]);
    // Cada partida empieza sin tensión heredada de la anterior.
    reiniciarTension();
    this.publicarTension();

    // Universal desde colocacion-naves (nav-1): con nave.y presente (modo
    // espacial) se usa tal cual -- no hay ninguna columna de terreno bajo
    // una nave flotando de la que derivar su altura -- y con nave.y ausente
    // (suelo plano de siempre) se sigue derivando en vivo con
    // alturaSuperficie, exactamente como antes de este bloque.
    // multi-setup-partida: las naves pares miran a +x y las impares a -x,
    // como las dos de siempre; con 3-4 el ángulo inicial es solo cosmético
    // (el control lo sustituye en cuanto le toca a un humano).
    // La escena se reutiliza al reiniciar: los fantasmas de la partida anterior
    // ya no existen en pantalla y no deben contarse en esta.
    this.fantasmasNave = new Map();
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
    this.indicadorDeriva = new IndicadorDeriva(this, 140, 70);
    this.refrescarIndicadorDeriva();

    this.animador = new AnimadorProyectil(this);
    this.animadorRepeticion = new AnimadorProyectil(this);
    this.contadorAdherencia = new ContadorAdherencia(this);
    // Depth 30: por debajo de la estela del proyectil real (40, que solo
    // existe durante el vuelo, cuando la previsualización ya está oculta),
    // por encima del terreno y las naves.
    this.graficosRastro = this.add.graphics().setDepth(29);
    this.graficosPrevisualizacion = this.add.graphics().setDepth(30);
    this.graficosFlecha = this.add.graphics().setDepth(31);
    this.etiquetaFlecha = this.add
      .text(0, 0, "", { fontSize: "34px", color: "#ffffff", backgroundColor: "#101a33", padding: { x: 8, y: 4 } })
      .setOrigin(0.5)
      .setDepth(32)
      .setVisible(false);
    this.gestoApuntado = null;
    this.punteroApuntando = null;
    this.estadisticas = reanudar
      ? this.estado.naves.map((_nave, id) => reanudar.cascara.estadisticasPorNave?.[id] ?? reanudar.cascara.estadisticas)
      : this.estado.naves.map(() => estadisticasIniciales());
    this.estadisticasAsientos = estadisticasAsientosIniciales(this.estado.naves.length);
    this.trayectoriaDelTurno = null;
    reanudar?.cascara.memoriasIA.forEach((memoria, id) => {
      if (memoria) this.memoriaIA.set(id, { ...memoria, usosPorArma: { ...memoria.usosPorArma } });
    });
    this.fallosSeguidos = this.estado.naves.map(() => 0);
    this.turnosResueltos = 0;
    this.plantillasRecientes = [];

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
      get: () => ({ modo: this.motor.modo, motivo: this.motor.motivoEnLinea, ultimoTurno: this.ultimoTurnoMedido }),
    });
    Object.defineProperty(window.__debug, "tareasLargas", {
      configurable: true,
      enumerable: true,
      get: () => tareasLargasActuales(),
    });
    window.__debug.retenerCierreTurno = (retener: boolean) => this.motor.retenerCierre(retener);
    window.__debug.bloquearHilo = (ms: number) => this.medidorRespuesta.bloquearHilo(ms);
    // apuntado-dedo: latencia del gesto (pointermove → primer frame con la
    // flecha) y atajo de prueba para fijar el apuntado sin gesto. Mismas
    // condiciones de exposición que el resto de __debug (juego local, sin
    // marcador compartido).
    limpiarLatenciasApuntado();
    window.__debug.latencias = () => ultimasLatenciasApuntado();
    window.__debug.fijarApuntado = (anguloGrados: number, potencia: number) => fijarApuntadoDirecto(anguloGrados, potencia);
    Object.defineProperty(window.__debug, "relojTurno", {
      configurable: true,
      enumerable: true,
      get: () => {
        const { configuradoS, estado, restanteMs } = obtenerRelojTurno();
        return { configuradoS, estado, restanteMs };
      },
    });
    window.__debug.adelantarRelojTurno = (ms: number) => adelantarRelojTurno(ms);
    window.__debug.calculosPrevisualizacion = 0;
    window.__debug.forzarMiraOculta = (activa: boolean) => {
      this.costeMiraForzadoMs = activa ? PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS * 100 : 0;
      if (!activa) this.liberarMiraOculta();
    };
    // Publica un resumen hecho con el generador real a partir de un guion de
    // eventos, para ver sus textos sin jugar los turnos que lo provocan.
    window.__debug.publicarResumenPrueba = (id: string) => {
      const publicacion = guionResumenPrueba(id);
      const numeroTurno = (window.__debug!.historialBromas?.length ?? 0) + 1;
      publicarFantasmas([{ nave: 0, texto: publicacion.rotulo }]);
      publicarResumen(numeroTurno, publicacion.resumen, 1);
      window.__debug!.historialBromas = [
        ...(window.__debug!.historialBromas ?? []),
        { numeroTurno, tirador: 1, voz: vozDeNave(1, publicacion.personalidadId), categoria: undefined, resumen: publicacion.resumen, eventos: [] },
      ];
    };
    // Lo que cuesta pintar el lienzo se mide aparte: en el CI lo hace la CPU.
    const alInicioRender = (): void => this.medidorRespuesta.marcarInicioRender();
    const alFinRender = (): void => this.medidorRespuesta.marcarFinRender();
    this.game.events.on(Phaser.Core.Events.PRE_RENDER, alInicioRender);
    this.game.events.on(Phaser.Core.Events.POST_RENDER, alFinRender);
    const dejarDeObservar = this.medidorFrames.observarFramesLargos();
    const dejarDeObservarTareas = observarTareasLargas();
    const dejarDeMedirRespuesta = this.medidorRespuesta.observar();
    const quitarHud = new URLSearchParams(window.location.search).get("rendimiento") === "1" ? montarHudRendimiento(this.medidorFrames, this.medidorRespuesta, ultimasLatenciasApuntado) : null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      dejarDeObservar();
      dejarDeObservarTareas();
      if (this.temporizadorCalculando !== null) clearTimeout(this.temporizadorCalculando);
      ocultarCalculandoTurno();
      dejarDeMedirRespuesta();
      this.game.events.off(Phaser.Core.Events.PRE_RENDER, alInicioRender);
      this.game.events.off(Phaser.Core.Events.POST_RENDER, alFinRender);
      this.motor.terminar();
      ocultarApuntandoIA();
      quitarHud?.();
      this.retirarAvisoPerdido();
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
    this.emisorEstelaLlama = crearEmisorRegistrado(this, "estela-llama", 0, 0, "particula-estela", {
      lifespan: 180,
      speed: 0,
      scale: { start: 1.3, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: 0,
      emitting: false,
      maxParticles: TOPE_PARTICULAS_ESTELA_LLAMA,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.emisorEstelaLlama.setDepth(40);
    this.visualArmas = new VisualArmas(this, { llama: this.emisorEstelaLlama, humo: this.emisorEstela });
    this.animador.usarTexturaExterna(true);

    window.addEventListener("pointerdown", this.manejarPointerDown);
    window.addEventListener("pointermove", this.manejarPointerMove);
    window.addEventListener("pointerup", this.manejarPointerFin);
    window.addEventListener("pointercancel", this.manejarPointerFin);
    this.montarCamara();
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
    this.cancelarAlAgotarseReloj = registrarAlAgotarseReloj(() => this.agotarRelojTurno());
    document.addEventListener("visibilitychange", this.alCambiarVisibilidad);
    window.addEventListener("pagehide", this.alOcultarPagina);
    // El tick solo repinta: el plazo es absoluto y no depende de él.
    this.temporizadorReloj = window.setInterval(() => tickRelojTurno(), 250);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.limpiarEntrada());

    // humor-5: Phaser ya pausa/reanuda su bucle solo al cambiar de pestaña
    // (game.loop.pause/resume con suavizado de delta) -- aquí solo hace falta
    // engancharse a esos mismos eventos para que el audio no siga sonando ni
    // consumiendo el AudioContext en segundo plano.
    this.game.events.on(Phaser.Core.Events.PAUSE, pausarAudio);
    this.game.events.on(Phaser.Core.Events.PAUSE, callarVoz);
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
    window.__debug.avanzarHastaTurnoHumano = () => this.avanzarHastaTurnoHumano();
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
    window.__debug.armas = Object.fromEntries(
      aspectosDelCatalogo().map((a) => [a.armaId, { trazado: trazadoDeArma(a.armaId), textura: `arma-${a.armaId}`, estela: a.estela, giroRadS: a.giroRadS }]),
    );
    window.__debug.proyectilVisual = null;
    window.__debug.armaEnReposo = null;
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
      const acotada = Math.max(0, Math.min(INTEGRIDAD_MAXIMA, integridad));
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
    window.__debug.remate = { activo: false, completados: 0, destellosCamara: [], ultimo: null };
    window.__debug.turno = this.estado.turno;
    publicarTurno(this.estado.turno);
    window.__debug.numeroTurno = this.estado.numeroTurno;
    this.refrescarEconomia();
    this.refrescarRobots();
    this.refrescarObjetos();
    publicarJugable(this.puedeJugarAhora());
    publicarPreparando(false);

    Object.defineProperty(window.__debug, "partidaGuardada", {
      configurable: true,
      enumerable: true,
      get: () => this.guardador.estado(),
    });
    // Una partida nueva sustituye a cualquier instantánea anterior; reanudar
    // reescribe la misma con la versión actual del juego.
    // Una partida nueva no guarda nada hasta cerrar su primer turno: así el
    // aviso de «sin guardado» (una vez por partida) sale cuando se juega, no
    // durante la carga.
    if (!reanudar) this.guardador.borrar();
    else {
      this.guardarTurnoCerrado();
      this.reanudarTurnoGuardado();
    }
  }

  update(_time: number, delta: number): void {
    this.medidorFrames.registrarFrame(delta);
    this.actualizarRotuloDeriva();
    this.animador.actualizar(delta);
    this.animadorRepeticion.actualizar(delta);
    window.__debug!.animacionEnCurso = this.animador.enVuelo();
    window.__debug!.repeticionEnCurso = this.animadorRepeticion.enVuelo();
    this.actualizarEstelaYDebugProyectil(delta);
    this.actualizarArmaEnReposo();
    this.actualizarCuentaAtrasMecha();
    this.actualizarCuentaAtrasAdherencia();

    // humor-1: la cámara sacude durante la reacción a un evento de humor --
    // hay que refrescar el rectángulo visible cada fotograma mientras dura
    // esa sacudida, no solo una vez en create() (ver el comentario allí sobre
    // por qué el primer fotograma no sirve).
    // camara-gestos: el controlador mueve la cámara antes de leer su vista.
    this.camaraCtl.avanzar(delta);
    this.camaraCtl.seguir(this.animador.obtenerPosicion(), delta);
    const estadoCamara = this.camaraCtl.estado();
    window.__debug!.camara = { x: estadoCamara.x, y: estadoCamara.y, ancho: estadoCamara.ancho, alto: estadoCamara.alto, zoom: estadoCamara.zoom, modo: estadoCamara.modo };
    publicarCamaraManual(this.camaraCtl.manual);
    this.cerrarMedidaCamara();
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

    this.actualizarRemate(delta);
    this.avanzarMovimientos(delta);

    const jugable = this.puedeJugarAhora();
    publicarJugable(jugable);
    this.sincronizarRelojTurno(jugable);


    this.actualizarPrevisualizacion(jugable);
    this.actualizarRastro();
    this.actualizarFlechaApuntado();
    // paron-explosion: la subida del terreno a la GPU, una vez por frame y
    // después de lanzar las explosiones del frame (el destello va primero).
    this.terreno.vaciarCola();
  }

  // rastro-ultimo-disparo: redibuja solo cuando cambia el rastro o el
  // interruptor, y cierra la medida 'rastro' del toque en «Rastro».
  private actualizarRastro(): void {
    const activo = obtenerEstadoControl().rastroActivo;
    const rastro = rastroVisible(this.rastros, activo);
    const previo = this.rastroPintado;
    if (previo === null || previo.rastro !== this.rastros.ultimo || previo.activo !== activo) {
      dibujarRastro(this.graficosRastro, rastro);
      this.rastroPintado = { rastro: this.rastros.ultimo, activo };
      if (previo !== null && previo.activo !== activo && performance.getEntriesByName("rastro-toque", "mark").length > 0) {
        registrarLatenciaRastro(performance.measure("rastro-frame", "rastro-toque").duration);
        performance.clearMarks("rastro-toque");
        performance.clearMeasures("rastro-frame");
      }
    }
    const ultimo = this.rastros.ultimo;
    window.__debug!.rastro =
      ultimo === null
        ? null
        : {
            asiento: ultimo.asiento,
            puntos: ultimo.puntos,
            impacto: ultimo.impacto,
            color: colorDeAsiento(ultimo.asiento),
            silueta: (ultimo.asiento % 4) as 0 | 1 | 2 | 3,
            visible: rastro !== null,
            estilo: { discontinuo: true, alfa: ALFA_RASTRO },
          };
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
      window.__debug!.trayectoriaPantalla = null;
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
      window.__debug!.trayectoriaPantalla = null;
      this.dibujarPrevisualizacionPropulsores(estado, anguloGrados, potencia);
      return;
    }
    window.__debug!.previsualizacionPropulsores = null;
    publicarPropulsoresBloqueados(false);

    // impacto-naves: mismo criterio que dispararEntrada -- el casco solo
    // existe como cuerpo de colisión en modo espacial, con naves vivas.
    const modoEspacial = naveTiradora.y !== undefined && naveObjetivo.y !== undefined;
    const navesVivas = modoEspacial
      ? estado.naves
          .map((nave, id) => ({ id: id as IdNave, nave }))
          .filter(({ nave }) => nave.integridad > 0)
          .map(({ id, nave }) => ({ id, x: nave.x, y: nave.y as number, integridad: nave.integridad }))
      : undefined;
    const geometria = geometriaTrayectoria({ anchoCss: window.innerWidth, altoCss: window.innerHeight, armaId });
    const origenPantalla = mundoAPantallaCss(this, { x: origenX, y: origenY - ALTURA_CANON_PX });
    const anguloGradosActual = anguloGrados;

    // mira-oculta-timeouts: si el cálculo superó el presupuesto, el apuntado no
    // lo repite; la trayectoria no desaparece, se pinta como cuñas rectas.
    if (this.miraOculta !== null) {
      if (this.miraOculta.estado === estado && !tocaReintentarMira(this.miraOculta, this.time.now)) {
        this.dibujarCunas(geometria, origenPantalla, anguloGradosActual);
        return;
      }
      this.liberarMiraOculta();
    }
    // respuesta-200ms: la mira se calcula en el trabajador, "la última gana".
    // Mientras llega la nueva se sigue dibujando la anterior del MISMO estado:
    // un parpadeo por frame sin mira sería peor que un cuadro de retraso.
    const cam = this.cameras.main;
    const rectLienzo = this.game.canvas.getBoundingClientRect();
    const mundoPorPx = cam.width / cam.zoom / rectLienzo.width;
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
      // La cota se redondea para que un zoom que vibra no pida un cálculo nuevo
      // por fotograma; el recorte exacto se hace después, en pantalla.
      abanico: {
        semiapertura1: geometria.semiapertura1,
        semiapertura2: geometria.semiapertura2,
        longitudMundoMax: Math.ceil(geometria.radioTramo2Px * mundoPorPx * 1.05),
      },
    }, estado);
    const vigente = this.previsVigente;
    if (!vigente || vigente.estado !== estado || !vigente.abanico) {
      this.dibujarCunas(geometria, origenPantalla, anguloGradosActual);
      return;
    }
    const { abanico, duracionMs: duracionComputoMs } = vigente;

    // gravedad-visible (grav-vis-5): si no cabe en su presupuesto de cómputo, se
    // pasa a cuñas rectas antes que dibujar un trazado que ya ha costado más de
    // lo prometido.
    if (abanico.centro.length < 2 || superaPresupuestoAbanico(duracionComputoMs + this.costeMiraForzadoMs)) {
      if (abanico.centro.length >= 2) this.miraOculta = { ...ocultarMira(this.time.now, this.costeMiraForzadoMs > 0), estado };
      this.dibujarCunas(geometria, origenPantalla, anguloGradosActual);
      return;
    }

    const aPantalla = (puntos: readonly { x: number; y: number }[]): PuntoPantalla[] => puntos.map((p) => mundoAPantallaCss(this, p));
    const r1 = geometria.radioTramo1Px;
    const r2 = geometria.radioTramo2Px;
    const centro = cortarPorLongitudPantalla(aPantalla(abanico.centro), r2);
    const menor1 = cortarPorLongitudPantalla(aPantalla(abanico.tramo1.menor), r1);
    const mayor1 = cortarPorLongitudPantalla(aPantalla(abanico.tramo1.mayor), r1);
    const menor2 = tramoEntre(aPantalla(abanico.tramo2.menor), r1, r2);
    const mayor2 = tramoEntre(aPantalla(abanico.tramo2.mayor), r1, r2);

    this.pintarFranja(menor2, mayor2, COLOR_ABANICO_TRAMO2, 0.18);
    this.pintarFranja(menor1, mayor1, COLOR_ABANICO_TRAMO1, 0.35);
    // gravedad-visible (grav-vis-3): el ancho se expresa en píxeles de PANTALLA y
    // se convierte a mundo, o a este encuadre el trazo sería sub-píxel.
    this.graficosPrevisualizacion.lineStyle(this.cssAMundo(ANCHO_MIRA_CSS_PX), 0x9ad1ff, 0.9);
    for (let i = 1; i < centro.length; i++) {
      if (i % 2 === 0) continue;
      this.lineaPantalla(centro[i - 1], centro[i]);
    }

    const puntosMundo = centro.map((p) => pantallaCssAMundo(this, p));
    window.__debug!.previsualizacion = { puntos: puntosMundo.map((p) => ({ x: p.x, y: p.y })), visible: true };
    this.publicarTrayectoria(geometria, "simulada", longitudDeArco(centro));
  }

  private cssAMundo(px: number): number {
    return px * this.scale.displayScale.x / this.cameras.main.zoom;
  }

  private lineaPantalla(a: PuntoPantalla, b: PuntoPantalla): void {
    const wa = pantallaCssAMundo(this, a);
    const wb = pantallaCssAMundo(this, b);
    this.graficosPrevisualizacion.lineBetween(wa.x, wa.y, wb.x, wb.y);
  }

  // Franja entre dos bordes que nacen en el mismo punto: relleno y borde fino.
  private pintarFranja(menor: readonly PuntoPantalla[], mayor: readonly PuntoPantalla[], color: number, alfa: number): void {
    if (menor.length < 2 || mayor.length < 2) return;
    const poligono = [...menor, ...[...mayor].reverse()].map((p) => {
      const w = pantallaCssAMundo(this, p);
      return new Phaser.Math.Vector2(w.x, w.y);
    });
    this.graficosPrevisualizacion.fillStyle(color, alfa);
    this.graficosPrevisualizacion.fillPoints(poligono, true);
    this.graficosPrevisualizacion.lineStyle(this.cssAMundo(ANCHO_BORDE_ABANICO_CSS_PX), COLOR_BORDE_ABANICO, 0.7);
    for (const borde of [menor, mayor]) {
      for (let i = 1; i < borde.length; i++) this.lineaPantalla(borde[i - 1], borde[i]);
    }
  }

  // Modo 'cunas': dos cuñas rectas con las mismas aperturas y radios. No simula
  // nada, así que es lo que se ve cuando el cálculo no llega a tiempo.
  private dibujarCunas(geometria: GeometriaTrayectoria, origen: PuntoPantalla, anguloGrados: number): void {
    const en = (delta: number, radio: number): PuntoPantalla => {
      const rad = ((anguloGrados + delta) * Math.PI) / 180;
      return { x: origen.x + Math.cos(rad) * radio, y: origen.y - Math.sin(rad) * radio };
    };
    const { radioTramo1Px: r1, radioTramo2Px: r2, semiapertura1: a1, semiapertura2: a2 } = geometria;
    this.pintarFranja([en(-a2, r1), en(-a2, r2)], [en(a2, r1), en(a2, r2)], COLOR_ABANICO_TRAMO2, 0.18);
    this.pintarFranja([origen, en(-a1, r1)], [origen, en(a1, r1)], COLOR_ABANICO_TRAMO1, 0.35);
    this.graficosPrevisualizacion.lineStyle(this.cssAMundo(ANCHO_MIRA_CSS_PX), 0x9ad1ff, 0.9);
    this.lineaPantalla(origen, en(0, r2));
    window.__debug!.previsualizacion = null;
    this.publicarTrayectoria(geometria, "cunas", r2);
  }

  private publicarTrayectoria(geometria: GeometriaTrayectoria, modo: "simulada" | "cunas", longitudPantallaPx: number): void {
    window.__debug!.trayectoriaPantalla = {
      visible: true,
      L: geometria.L,
      longitudPantallaPx,
      tramo1: { radioPx: geometria.radioTramo1Px, semiaperturaGrados: geometria.semiapertura1 },
      tramo2: { radioPx: geometria.radioTramo2Px, semiaperturaGrados: geometria.semiapertura2 },
      modo,
    };
  }

  // Una sola petición de mira en vuelo; si mientras tanto cambia el ajuste, se
  // guarda solo la más reciente y se envía al volver la anterior.
  private pedirPrevisualizacion(peticion: Parameters<ClienteSim["previsualizar"]>[0], estado: EstadoPartida): void {
    const clave = JSON.stringify([peticion.tirador, peticion.origenX, peticion.origenY, peticion.anguloGrados, peticion.potencia, peticion.armaId, peticion.abanico]);
    if (this.previsClave === clave && this.previsEstadoPedido === estado) return;
    this.previsClave = clave;
    this.previsEstadoPedido = estado;
    this.previsPendiente = { peticion, estado };
    this.enviarPrevisualizacion();
  }

  // Vuelve a pedir la mira una vez con el ajuste vigente. La clave se borra
  // porque, con el ajuste quieto, pedirPrevisualizacion no volvería a pedirla.
  private liberarMiraOculta(): void {
    this.miraOculta = null;
    this.previsClave = "";
    this.previsVigente = null;
  }

  private enviarPrevisualizacion(): void {
    if (this.previsEnCurso || !this.previsPendiente) return;
    if (this.miraOculta !== null) {
      this.previsPendiente = null;
      return;
    }
    const { peticion, estado } = this.previsPendiente;
    this.previsPendiente = null;
    this.previsEnCurso = true;
    this.calculosPrevisualizacion++;
    window.__debug!.calculosPrevisualizacion = this.calculosPrevisualizacion;
    void this.motor.previsualizar(peticion).then((resultado) => {
      this.previsEnCurso = false;
      if (resultado) this.previsVigente = { estado, banda: resultado.banda, abanico: resultado.abanico, duracionMs: resultado.duracionMs };
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
    // Bloqueado: la nave no llegaría a salir (apunta hacia dentro del planeta).
    // Se pinta en rojo y el HUD no deja gastar el turno.
    const bloqueado = vuelo.motivo === "obstaculo" && Math.hypot(vuelo.destino.x - nave.x, vuelo.destino.y - nave.y) < DISTANCIA_MINIMA_PROPULSORES_PX;
    publicarPropulsoresBloqueados(bloqueado);
    grafico.lineStyle(grosor, bloqueado ? 0xff4d4d : 0xffd23f, 0.95);
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
  private actualizarEstelaYDebugProyectil(deltaMs: number): void {
    const posicion = this.animador.obtenerPosicion();
    if (posicion) {
      const armaId = this.animador.obtenerArmaId() ?? CATALOGO_ARMAS[0].id;
      // armas-aspecto: la textura rota con el rumbo (más el giro propio de las
      // que ruedan) y la estela sale de la misma capa. emitParticleAt necesita
      // el recuento explícito: la config del emisor lleva quantity 0.
      const muestra = this.visualArmas.actualizarVuelo(armaId, posicion.x, posicion.y, this.animador.obtenerAnguloActual(), deltaMs, prefiereMovimientoReducido());
      // Con el Racimo abierto los perdigones ya los dibuja el animador.
      if (this.animador.obtenerPerdigones() > 1) this.visualArmas.ocultarVuelo();
      window.__debug!.proyectilEnVuelo = { x: posicion.x, y: posicion.y, armaId };
      window.__debug!.proyectilVisual = {
        armaId,
        textura: muestra.textura,
        rotacion: muestra.rotacion,
        rumbo: muestra.rumbo,
        particulasEstela: muestra.particulasEstela,
      };
    } else {
      this.visualArmas.finDeVuelo();
      window.__debug!.proyectilEnVuelo = null;
      window.__debug!.proyectilVisual = null;
    }
    const vivas = this.emisorEstela.getAliveParticleCount() + this.emisorEstelaLlama.getAliveParticleCount();
    window.__debug!.proyectil = { perdigones: this.animador.obtenerPerdigones(), perdigonesMaximo: this.animador.obtenerPerdigonesMaximo() };
    window.__debug!.estela = { vivas, tope: TOPE_PARTICULAS_ESTELA + TOPE_PARTICULAS_ESTELA_LLAMA };
    window.__debug!.estelaMaxVivas = Math.max(window.__debug!.estelaMaxVivas ?? 0, vivas);
  }

  // armas-aspecto: el arma elegida va montada en el lanzador de la nave del
  // turno, con el ángulo del apuntado. Solo cuando se puede jugar: durante el
  // vuelo ya la lleva el proyectil.
  private actualizarArmaEnReposo(): void {
    const debug = window.__debug!;
    if (!this.puedeJugarAhora() || this.animador.enVuelo()) {
      this.visualArmas.ocultarReposo();
      debug.armaEnReposo = null;
      return;
    }
    const estado = this.estado;
    const nave = estado.naves[estado.turno];
    const origenY = nave.y ?? alturaSuperficie(estado.mascara, nave.x);
    if (origenY === null || origenY === undefined) {
      this.visualArmas.ocultarReposo();
      debug.armaEnReposo = null;
      return;
    }
    const { anguloGrados, armaId } = obtenerEstadoControl().ajuste;
    // Mismo signo que el vuelo: vy = -v·sen(ángulo), así que la imagen gira -ángulo.
    const rotacion = -(anguloGrados * Math.PI) / 180;
    this.visualArmas.mostrarReposo(armaId, nave.x, origenY - ALTURA_CANON_PX, rotacion);
    debug.armaEnReposo = { armaId, rotacion };
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
  // partida-completa (solo e2e): entre dos toques del jugador pasan los turnos
  // de las IAs, con sus vuelos y explosiones. En el CI, con el lienzo rasterizado
  // por software, cada vuelo animado tarda ~70 s de reloj real, así que se
  // empuja el reloj de la animación con update() como hace la ráfaga turbo. El
  // estado que se alcanza es el mismo; solo se evita esperar un fotograma real
  // por paso. Cada tanda cede el hilo para que lleguen el trabajador y los
  // temporizadores reales (nada de bucle síncrono sin fin).
  private async avanzarHastaTurnoHumano(): Promise<void> {
    const PASO_TURBO_MS = 32;
    const TANDA = 200;
    for (let guardia = 0; guardia < 400 && this.estado.resultado.tipo !== "terminada" && !this.puedeJugarAhora(); guardia++) {
      // solicitudEnCurso ya no acaba al llegar el impacto, sino al aplicar el cierre
      // tras la animación: hay que seguir empujando el reloj mientras tanto.
      for (let i = 0; i < TANDA && !this.puedeJugarAhora(); i++) this.update(0, PASO_TURBO_MS);
      await new Promise<void>((resolver) => setTimeout(resolver, 0));
    }
  }

  private async dispararRafagaTurbo(numeroDeDisparos: number): Promise<void> {
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
          naves: this.estado.naves.map((actual) => ({ ...actual, integridad: INTEGRIDAD_MAXIMA })),
        };
        this.refrescarDebugNaves();
      } else if (this.solicitudEnCurso) {
        // respuesta-200ms: la decisión de la IA y la resolución del disparo
        // viven en el trabajador; se cede el hilo para que su respuesta
        // llegue en vez de salir de la ráfaga con un solo turno jugado.
        // El cierre del turno se aplica al acabar la animación del impacto, que
        // aquí avanza con update(): si hay algo en vuelo se empuja el reloj.
        if (this.animador.enVuelo() || this.avanceTurnoPendiente || this.remate?.bloquea || this.movimientos.length > 0) this.update(0, PASO_TURBO_MS);
        else await new Promise<void>((resolver) => setTimeout(resolver, 0));
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
      } else if (this.animador.enVuelo() || this.animadorRepeticion.enVuelo() || this.avanceTurnoPendiente || this.remate?.bloquea || this.movimientos.length > 0) {
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
      !this.remate?.bloquea &&
      this.movimientos.length === 0 &&
      !this.relevoPendiente &&
      !this.solicitudEnCurso
    );
  }

  private limpiarEntrada(): void {
    window.removeEventListener("pointerdown", this.manejarPointerDown);
    window.removeEventListener("pointermove", this.manejarPointerMove);
    window.removeEventListener("pointerup", this.manejarPointerFin);
    window.removeEventListener("pointercancel", this.manejarPointerFin);
    this.cancelarCamara?.();
    this.cancelarCamara = null;
    this.cancelarManejadorDisparo?.();
    this.cancelarManejadorDisparo = null;
    this.cancelarManejadorRepeticion?.();
    this.cancelarManejadorRepeticion = null;
    this.cancelarManejadorRelevo?.();
    this.cancelarManejadorRelevo = null;
    this.cancelarAlAgotarseReloj?.();
    this.cancelarAlAgotarseReloj = null;
    document.removeEventListener("visibilitychange", this.alCambiarVisibilidad);
    window.removeEventListener("pagehide", this.alOcultarPagina);
    if (this.temporizadorReloj !== null) window.clearInterval(this.temporizadorReloj);
    this.temporizadorReloj = null;
    pararRelojTurno();
    this.game.events.off(Phaser.Core.Events.PAUSE, pausarAudio);
    this.game.events.off(Phaser.Core.Events.PAUSE, callarVoz);
    callarVoz();
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
    obtenerLocutor().iniciar();

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
    if (evento.target !== this.game.canvas) return;
    this.punterosLienzo.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
    if (this.punterosLienzo.size >= 2) {
      // cam-2: un segundo dedo cancela el apuntado y deja la mira como estaba
      // antes de ese gesto; no se reanuda hasta un pointerdown nuevo.
      this.cancelarApuntadoPorSegundoDedo();
      return;
    }
    if (this.puedeJugarAhora()) {
      this.punteroApuntando = evento.pointerId;
      this.dedoApuntado = { x: evento.clientX, y: evento.clientY };
      // El primer toque no cambia nada: solo ancla el gesto.
      // El ajuste de este pointerdown se guarda aparte: el gesto reajusta su
      // base al cruzar la zona muerta de la nave, y cam-2 pide el de entonces.
      const { anguloGrados, potencia } = obtenerEstadoControl().ajuste;
      this.ajusteAlApoyar = { anguloGrados, potencia };
      this.gestoApuntado = iniciarGestoPolar(obtenerEstadoControl().ajuste, this.posicionPantallaNaveDelTurno(), this.dedoApuntado);
    }
  }

  private cancelarApuntadoPorSegundoDedo(): void {
    const inicial = this.ajusteAlApoyar;
    if (this.gestoApuntado !== null && inicial !== null) fijarApuntadoDirecto(inicial.anguloGrados, inicial.potencia);
    this.soltarApuntado();
  }

  private alPointerMove(evento: PointerEvent): void {
    const previo = this.punterosLienzo.get(evento.pointerId);
    if (previo !== undefined) {
      this.punterosLienzo.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
      if (this.punterosLienzo.size >= 2) {
        this.gestoDosDedos(evento.pointerId, previo);
        return;
      }
    }
    if (this.punteroApuntando !== evento.pointerId) return;
    if (!this.puedeJugarAhora()) {
      this.soltarApuntado();
      return;
    }
    this.apuntarHacia(evento.clientX, evento.clientY);
  }

  private alPointerFin(evento: PointerEvent): void {
    this.punterosLienzo.delete(evento.pointerId);
    if (this.punteroApuntando === evento.pointerId) this.soltarApuntado();
  }

  // cam-1: pellizco y arrastre con dos dedos. Se compara cada movimiento con
  // la posición anterior de los dos (patrón de MDN para dos punteros), así el
  // resultado no depende de cuántos eventos trocean el gesto.
  private gestoDosDedos(movido: number, anterior: { x: number; y: number }): void {
    const [a, b] = [...this.punterosLienzo.entries()];
    const antes = (id: number, actual: { x: number; y: number }): { x: number; y: number } => (id === movido ? anterior : actual);
    const a0 = antes(a[0], a[1]);
    const b0 = antes(b[0], b[1]);
    const dist0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
    const dist1 = Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y);
    if (dist0 < 1) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const fraccion = (p: { x: number; y: number }): { fx: number; fy: number } => ({ fx: (p.x - rect.left) / rect.width, fy: (p.y - rect.top) / rect.height });
    const marca = `camara-${this.contadorMarcasCamara++}`;
    performance.mark(marca);
    this.marcaCamaraPendiente ??= { marca, nombre: "gesto-camara" };
    this.camaraCtl.transformar(
      fraccion({ x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }),
      fraccion({ x: (a[1].x + b[1].x) / 2, y: (a[1].y + b[1].y) / 2 }),
      dist1 / dist0,
    );
    cerrarAyudaCamara();
  }

  // Rueda y pellizco de trackpad (ctrlKey): zoom del juego, no de la página.
  private readonly manejarRueda = (evento: WheelEvent): void => {
    evento.preventDefault();
    if (this.remate?.bloquea) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const f = { fx: (evento.clientX - rect.left) / rect.width, fy: (evento.clientY - rect.top) / rect.height };
    // El pellizco del trackpad llega con deltas mucho más finos que la rueda.
    const paso = evento.ctrlKey ? 0.01 : 0.0015;
    const marca = `camara-${this.contadorMarcasCamara++}`;
    performance.mark(marca);
    this.marcaCamaraPendiente ??= { marca, nombre: "gesto-camara" };
    this.camaraCtl.transformar(f, f, Math.exp(-evento.deltaY * paso));
    cerrarAyudaCamara();
  };

  private montarCamara(): void {
    const canvas = this.game.canvas;
    this.camaraCtl = new ControladorCamara({ ancho: this.scale.width, alto: this.scale.height }, this.cameras.main, prefiereMovimientoReducido);
    reiniciarCamaraHud();
    this.punterosLienzo.clear();
    // Sin esto el navegador se queda el pellizco y el arrastre para hacer zoom
    // y desplazar la página.
    canvas.style.touchAction = "none";
    canvas.addEventListener("wheel", this.manejarRueda, { passive: false });
    const quitarVerTodo = registrarManejadorVerTodo(() => {
      const marca = `camara-${this.contadorMarcasCamara++}`;
      performance.mark(marca);
      this.marcaCamaraPendiente = { marca, nombre: "ver-todo" };
      this.camaraCtl.verTodo();
    });
    this.cancelarCamara = () => {
      canvas.removeEventListener("wheel", this.manejarRueda);
      quitarVerTodo();
    };
  }

  // Cierra la medida en el primer frame tras el gesto, como la del apuntado.
  private cerrarMedidaCamara(): void {
    const pendiente = this.marcaCamaraPendiente;
    if (pendiente === null) return;
    this.marcaCamaraPendiente = null;
    registrarLatenciaCamara(pendiente.nombre, performance.measure(`${pendiente.marca}-frame`, pendiente.marca).duration);
  }

  private soltarApuntado(): void {
    this.punteroApuntando = null;
    this.gestoApuntado = null;
    this.ajusteAlApoyar = null;
    this.dedoApuntado = null;
    this.marcaApuntadoPendiente = null;
    this.graficosFlecha?.clear();
    this.etiquetaFlecha?.setVisible(false);
  }

  // Posición de la nave del turno en píxeles CSS, medida contra el rectángulo
  // real del lienzo (con Scale.FIT puede haber bandas laterales).
  private posicionPantallaNaveDelTurno(): { x: number; y: number } {
    const nave = this.estado.naves[this.estado.turno];
    const y = alturaRenderNave(nave.y, alturaSuperficie(this.estado.mascara, nave.x) ?? MUNDO_ALTO - 1);
    return mundoAPantallaCss(this, { x: nave.x, y });
  }

  private apuntarHacia(clienteX: number, clienteY: number): void {
    if (this.gestoApuntado === null) return;
    const dedo = { x: clienteX, y: clienteY };
    const marca = `apuntado-${this.contadorMarcasApuntado++}`;
    performance.mark(marca);
    const { anguloGrados, potencia } = obtenerEstadoControl().ajuste;
    const resultado = avanzarGestoPolar(this.gestoApuntado, this.posicionPantallaNaveDelTurno(), dedo);
    this.gestoApuntado = resultado.gesto;
    this.dedoApuntado = dedo;
    if (resultado.ajuste.anguloGrados !== anguloGrados || resultado.ajuste.potencia !== potencia) {
      fijarApuntadoDirecto(resultado.ajuste.anguloGrados, resultado.ajuste.potencia);
    }
    // Solo se mide la última marca sin pintar: si llegan varios pointermove
    // antes del frame, todos se pintan en el mismo y el más viejo es el peor caso.
    this.marcaApuntadoPendiente ??= marca;
  }

  // apuntado-dedo: flecha desde la nave con la dirección y una longitud
  // proporcional a la fuerza, y la etiqueta «grados · fuerza» en su punta,
  // desplazada si el dedo quedaría encima. Se dibuja en el frame, y es en ese
  // mismo frame donde se cierra la medida de latencia del gesto.
  private actualizarFlechaApuntado(): void {
    const g = this.graficosFlecha;
    g.clear();
    if (this.punteroApuntando === null || this.dedoApuntado === null || !this.puedeJugarAhora()) {
      this.etiquetaFlecha.setVisible(false);
      return;
    }
    // Con zoom, la flecha se coloca con la cámara real y su grosor se escala
    // para seguir midiendo lo mismo en pantalla.
    const mundoPorPx = this.cssAMundo(1);
    const naveP = this.posicionPantallaNaveDelTurno();
    const { anguloGrados, potencia } = obtenerEstadoControl().ajuste;
    const rad = (anguloGrados * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = -Math.sin(rad);
    const largoPx = 36 + (potencia / 100) * 90;
    const punta = { x: naveP.x + dx * largoPx, y: naveP.y + dy * largoPx };
    const aMundo = (p: { x: number; y: number }): { x: number; y: number } => pantallaCssAMundo(this, p);
    const origenM = aMundo({ x: naveP.x + dx * 18, y: naveP.y + dy * 18 });
    const puntaM = aMundo(punta);
    g.lineStyle(5 * mundoPorPx, 0xffd166, 0.95);
    g.lineBetween(origenM.x, origenM.y, puntaM.x, puntaM.y);
    // Cabeza de la flecha: dos trazos a ±150° de la dirección.
    for (const giro of [2.62, -2.62]) {
      const cx = Math.cos(rad + giro);
      const cy = -Math.sin(rad + giro);
      const finM = aMundo({ x: punta.x + cx * 12, y: punta.y + cy * 12 });
      g.lineBetween(puntaM.x, puntaM.y, finM.x, finM.y);
    }
    // Etiqueta: más allá de la punta, o a un lado si el dedo está debajo.
    const dedo = this.dedoApuntado;
    const candidatos = [
      { x: punta.x + dx * 26, y: punta.y + dy * 26 },
      { x: punta.x - dy * 44, y: punta.y + dx * 44 },
      { x: punta.x + dy * 44, y: punta.y - dx * 44 },
    ];
    const lejos = (c: { x: number; y: number }): number => Math.hypot(c.x - dedo.x, c.y - dedo.y);
    const elegido = candidatos.find((c) => lejos(c) >= 56) ?? candidatos.reduce((a, b) => (lejos(b) > lejos(a) ? b : a));
    const etiquetaM = aMundo(elegido);
    this.etiquetaFlecha.setText(`${Math.round(anguloGrados)}° · ${Math.round(potencia)}`);
    // 14 px CSS de texto, con independencia de la escala del mundo.
    this.etiquetaFlecha.setScale((14 * mundoPorPx) / 34);
    this.etiquetaFlecha.setPosition(etiquetaM.x, etiquetaM.y).setVisible(true);
    window.__debug!.flechaApuntado = { anguloGrados, potencia, etiqueta: this.etiquetaFlecha.text, puntaX: punta.x, puntaY: punta.y, etiquetaX: elegido.x, etiquetaY: elegido.y, naveX: naveP.x, naveY: naveP.y, dedoX: dedo.x, dedoY: dedo.y };
    if (this.marcaApuntadoPendiente !== null) {
      const marca = this.marcaApuntadoPendiente;
      this.marcaApuntadoPendiente = null;
      const medida = performance.measure(`${marca}-frame`, marca);
      registrarLatenciaApuntado(medida.duration);
    }
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
    if (esJugador) performance.mark("disparo-toque");

    const tirador: IdNave = estadoAntes.turno;
    const naveTiradora = estadoAntes.naves[tirador];
    const origenX = naveTiradora.x;
    const origenY = naveTiradora.y ?? alturaSuperficie(estadoAntes.mascara, origenX) ?? estadoAntes.mundo.alto - 1;

    // respuesta-disparo: la animación arranca con lo que se sabe tras el impacto
    // (eventosImpacto); el cierre del turno (desplazamientos, robots, universo)
    // llega después, ya calculado o aún en el trabajador.
    const continuar = (eventos: EventoSimulacion[], cierre: ResultadoAvanzar | Promise<ResultadoAvanzar | null>): void => {
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
      if (!prefiereMovimientoReducido()) this.visualArmas.fogonazo(inicial.x, inicial.y, aspectoDeId(entrada.arma).paleta.estela);
      // La latencia se cierra en el primer frame ya pintado (POST_RENDER), no al
      // encolar el efecto: es lo que percibe quien dispara.
      if (esJugador && performance.getEntriesByName("disparo-toque", "mark").length > 0) {
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          registrarLatenciaDisparo(performance.measure("disparo-frame", "disparo-toque").duration);
          performance.clearMarks("disparo-toque");
          performance.clearMeasures("disparo-frame");
        });
      }

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
      this.animador.fijarRacimo(
        armaDisparada.comportamiento.tipo === "submuniciones" && eventoImpacto
          ? { destino: { x: eventoImpacto.x, y: eventoImpacto.y }, cantidad: armaDisparada.comportamiento.cantidad }
          : null,
      );
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
        this.trayectoriaDelTurno = this.animador.obtenerTrayectoria().map((p) => ({ x: p.x, y: p.y }));
        // rastro-ultimo-disparo: sustituye al rastro anterior, sea de quien
        // sea; un tiro perdido (sin evento de impacto) no lleva silueta.
        this.rastros = registrarRastro(
          tirador,
          this.animador.obtenerTrayectoria().map((p) => ({ x: p.x, y: p.y })),
          eventoImpacto ? { x: final.x, y: final.y } : null,
        );
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
        this.esperarCierreDeTurno(cierre, (cerrado) => {
          const { estado: estadoDespues, eventos: eventosTurno, categoriaBroma, detonaciones } = cerrado;
          // realce-impacto (rlc-1): alAvanzarTurno encadena la respuesta de la
          // IA DESPUÉS de que el turno haya avanzado de verdad (inmediato, o
          // retrasado hasta que la sacudida vuelva a reposo) -- mismo motivo que
          // ya explicaba este comentario antes de este bloque: evita que
          // jugarTurnosGuionizados/forzarFinDePartida, que también llaman a
          // aplicarResultadoTurno pero con su propio guion de fuentes y SIN
          // estas opciones, disparen un turno extra no contado por su bucle.
          this.aplicarResultadoTurno(estadoDespues, eventosTurno, categoriaBroma, entrada.arma, {
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
      const resultadoAvance = avanzar(estadoAntes, entrada);
      continuar(resultadoAvance.eventos, resultadoAvance);
      return;
    }
    // respuesta-disparo: dos peticiones seguidas al trabajador. La del impacto
    // contesta en cuanto se sabe dónde cae y la pantalla anima; la del cierre
    // se pide en ese mismo momento y se calcula mientras el proyectil vuela.
    reiniciarTareasLargas();
    this.solicitudEnCurso = true;
    publicarJugable(false);
    void this.motor.resolverImpacto({ tipo: "resolverImpacto", estado: estadoAntes, entrada }).then((impacto) => {
      if (impacto === null) {
        this.solicitudEnCurso = false;
        publicarJugable(this.puedeJugarAhora());
        return;
      }
      const cierre = this.motor.cerrarTurno({ tipo: "cerrarTurno", fase: impacto.resultado }).then((cerrado) => {
        if (cerrado === null) return null;
        this.ultimoTurnoMedido = {
          msImpacto: impacto.metricas.duracionMs,
          msCierre: cerrado.metricas.duracionMs,
          esperaColaMs: impacto.metricas.esperaColaMs + cerrado.metricas.esperaColaMs,
          vuelosSimulados: impacto.metricas.vuelos + cerrado.metricas.vuelos,
          modo: this.motor.modo,
        };
        return cerrado.resultado;
      });
      continuar(impacto.resultado.eventos, cierre);
    });
  }

  // El cierre ya calculado se aplica al momento; si aún está en el trabajador,
  // se espera mostrando «Calculando el turno…» pasados 300 ms desde que acabó la
  // animación del impacto (este método se llama justo entonces).
  private esperarCierreDeTurno(cierre: ResultadoAvanzar | Promise<ResultadoAvanzar | null>, aplicar: (cerrado: ResultadoAvanzar) => void): void {
    if (!(cierre instanceof Promise)) {
      this.solicitudEnCurso = false;
      aplicar(cierre);
      return;
    }
    let llegado = false;
    this.temporizadorCalculando = setTimeout(() => {
      this.temporizadorCalculando = null;
      if (!llegado) mostrarCalculandoTurno();
    }, 300);
    void cierre.then((cerrado) => {
      llegado = true;
      if (this.temporizadorCalculando !== null) clearTimeout(this.temporizadorCalculando);
      this.temporizadorCalculando = null;
      ocultarCalculandoTurno();
      this.solicitudEnCurso = false;
      if (cerrado === null) {
        publicarJugable(this.puedeJugarAhora());
        return;
      }
      aplicar(cerrado);
    });
  }

  // escudo-y-propulsores: el turno entero se gasta en equipo, sin vuelo de
  // proyectil que animar. Comparte con el disparo el cierre de turno
  // (aplicarResultadoTurno) y el relevo, para que la IA o el siguiente humano
  // jueguen exactamente igual que tras un disparo.
  private usarEquipoEntrada(entrada: EntradaDeTurno, esJugador: boolean): void {
    const estadoAntes = this.estado;
    if (this.solicitudEnCurso) return;
    if (estadoAntes.resultado.tipo === "terminada" || this.animador.enVuelo()) return;
    limpiarCuentaAtras();
    const tirador: IdNave = estadoAntes.turno;
    // respuesta-200ms: los propulsores recolocan la nave simulando el recorrido
    // y su «descartar»; en el hilo principal eso bloqueaba el toque más de un
    // segundo en pantallas grandes, así que se resuelve en el trabajador igual
    // que el disparo.
    this.solicitudEnCurso = true;
    publicarJugable(false);
    void this.motor.resolverDisparo({ tipo: "resolverDisparo", estado: estadoAntes, entrada }).then((resultadoAvance) => {
      this.solicitudEnCurso = false;
      if (resultadoAvance === null) {
        publicarJugable(this.puedeJugarAhora());
        return;
      }
      this.cerrarTurnoDeEquipo(estadoAntes, entrada, esJugador, tirador, resultadoAvance);
    });
  }

  private cerrarTurnoDeEquipo(
    estadoAntes: EstadoPartida,
    entrada: EntradaDeTurno,
    esJugador: boolean,
    tirador: IdNave,
    resultadoAvance: ReturnType<typeof avanzar>,
  ): void {
    const { estado: estadoDespues, eventos, categoriaBroma, detonaciones } = resultadoAvance;
    if (esJugador) this.ultimoHumano = tirador;
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
    // cam-4: la vista completa antes de que el relevo enseñe nada.
    this.camaraCtl.alCambiarTurno();
    this.relevoPendiente = true;
    obtenerLocutor().callar();
    publicarJugable(false);
    publicarRelevo(
      nombreDeNave(this.controladores, siguiente),
      {
        tirador: nombreDeNave(this.controladores, tirador),
        arma: esIdEquipo(armaId) ? buscarEquipo(armaId).nombre : buscarArma(armaId).nombre,
        danio,
        fallo: danio === 0,
        sinTiempo: this.turnoSinTiempo === tirador,
        eliminadas: estadoAntes.naves.flatMap((nave, id) =>
          nave.integridad > 0 && estadoDespues.naves[id].integridad <= 0 ? [nombreDeNave(this.controladores, id)] : [],
        ),
      },
      null,
    );
  }

  // reloj-turno: el reloj corre solo mientras el turno humano es controlable:
  // arranca tras «Soy …» (o al habilitarse «Disparar» sin relevo) y se para en
  // cuanto deja de serlo (vuelo, relevo, turno de la IA).
  private sincronizarRelojTurno(jugable: boolean): void {
    const reloj = obtenerRelojTurno();
    if (reloj.configuradoS === null) return;
    if (!jugable) {
      if (reloj.estado !== "parado") pararRelojTurno();
      return;
    }
    const clave = `${this.estado.numeroTurno}:${this.estado.turno}`;
    if (reloj.estado !== "parado" || this.claveTurnoReloj === clave || document.visibilityState === "hidden") return;
    this.claveTurnoReloj = clave;
    this.turnoSinTiempo = null;
    arrancarRelojTurno();
    if (performance.getEntriesByName("reloj-toque", "mark").length > 0) {
      // Después del commit de React que pinta la píldora y antes del frame.
      requestAnimationFrame(() => {
        registrarLatenciaRelojTurno(performance.measure("reloj-frame", "reloj-toque").duration);
        performance.clearMarks("reloj-toque");
        performance.clearMeasures("reloj-frame");
      });
    }
  }

  private readonly alCambiarVisibilidad = (): void => {
    if (document.visibilityState === "hidden") {
      this.guardador.reescribirSiPendiente();
      if (obtenerRelojTurno().estado === "corriendo") {
        pausarRelojTurno();
        this.pausadaPorOculta = obtenerRelojTurno().estado === "pausado";
      }
    } else if (this.pausadaPorOculta) {
      this.pausadaPorOculta = false;
      reanudarRelojTurno();
    }
  };

  // Una sola vez por turno (el store solo pasa a 'agotado' desde 'corriendo',
  // y la clave lo cierra también si el toque del jugador coincide).
  private agotarRelojTurno(): void {
    if (!this.puedeJugarAhora()) return;
    this.turnoSinTiempo = this.estado.turno;
    mostrarAvisoTiempo();
    solicitarDisparoAutomatico();
  }

  // partida-guardada: una partida terminada no se puede continuar, así que su
  // instantánea se borra; el resto se reescribe en cada turno cerrado.
  private guardarTurnoCerrado(): void {
    if (!guardadoActivado()) return;
    if (this.estado.resultado.tipo === "terminada") {
      this.guardador.borrar();
      return;
    }
    this.guardador.guardar(this.datosParaGuardar());
  }

  private datosParaGuardar(): DatosPartida {
    const relojTurnoS = obtenerRelojTurno().configuradoS;
    return {
      estado: this.estado,
      config: {
        jugadores: this.jugadoresPartida,
        modo: this.estado.modo ?? "barra-libre",
        todosVemosTodo: Boolean(this.datosEscena.todosVemosTodo),
        semillaSistema: this.semillaSistemaPartida,
        mapaId: this.mapaIdPartida,
        relojTurnoS,
        ...(this.datosEscena.jugadores ? {} : { clasica: true as const }),
      },
      cascara: {
        memoriasIA: this.controladores.map((controlador, id) => (controlador.tipo === "ia" ? this.memoriaDe(id) : null)),
        estadisticas: this.estadisticas[0],
        estadisticasPorNave: this.estadisticas,
      },
    };
  }

  // Tras «Continuar»: el turno guardado vuelve a quien le tocaba. Con relevo
  // activo aparece primero su pantalla (el dispositivo puede estar en otras
  // manos); su reloj arranca entero tras «Soy …» como en cualquier turno.
  private reanudarTurnoGuardado(): void {
    const turno = this.estado.turno;
    const orden = this.estado.ordenTurno;
    const posicion = orden.indexOf(turno);
    for (let paso = 1; paso <= orden.length; paso += 1) {
      const anterior = orden[(posicion - paso + orden.length * paso) % orden.length];
      if (this.esHumano(anterior)) {
        this.ultimoHumano = anterior;
        break;
      }
    }
    if (!this.esHumano(turno)) {
      this.dispararTurnoIA();
      return;
    }
    this.ultimoHumano = turno;
    const humanos = this.controladores.filter((controlador) => controlador.tipo === "humano").length;
    if (this.datosEscena.todosVemosTodo || !this.datosEscena.jugadores || humanos < 2) return;
    this.relevoPendiente = true;
    obtenerLocutor().callar();
    publicarJugable(false);
    publicarRelevo(nombreDeNave(this.controladores, turno), null, null);
  }

  private readonly alOcultarPagina = (): void => this.guardador.reescribirSiPendiente();

  private confirmarRelevoActual(): void {
    if (!this.relevoPendiente) return;
    if (obtenerRelojTurno().configuradoS !== null) performance.mark("reloj-toque");
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
    const trazo = this.scale.displayScale.x;
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
    // El texto se coloca contra los bordes de la vista completa: el tiro salió
    // del mundo, así que se vuelve a ella.
    this.camaraCtl.alCambiarTurno();
    const { ancho, alto } = this.estado.mundo;
    // displayScale.x son unidades de mundo por px CSS: se multiplica para
    // pasar de px CSS a mundo (dividir dejaba el texto 8 veces más pequeño).
    const escala = this.scale.displayScale.x;
    this.retirarAvisoPerdido();
    const texto = this.add
      .text(0, 0, "¡Perdido!", { fontFamily: "sans-serif", fontSize: `${Math.round(22 * escala)}px`, fontStyle: "bold", color: "#ffd166", stroke: "#000000", strokeThickness: Math.round(4 * escala) })
      .setDepth(2000);
    // El lienzo puede asomar unos px CSS fuera del viewport: el margen se
    // cuenta desde la parte visible, no desde el 0 del mundo.
    const rect = this.game.canvas.getBoundingClientRect();
    const visibleArriba = Math.max(0, -rect.top) * escala;
    const visibleAbajo = alto - Math.max(0, rect.bottom - window.innerHeight) * escala;
    const margen = 12 * escala;
    // Franja de botones fijos de arriba (histórico, música, voz) y consola
    // de abajo: el aviso queda en el hueco entre ambas.
    // Si hay un aviso PWA arriba («Hay una versión nueva»), el «¡Perdido!» baja
    // por debajo de él en vez de quedar tapado.
    const bajoAvisoPwa = (this.finAvisoPwaPx() + 6 - rect.top) * escala;
    const minY = Math.max(visibleArriba + 64 * escala, bajoAvisoPwa);
    const maxY = Math.min(visibleAbajo - texto.height - margen, 440 * escala - texto.height);
    const x = Math.min(ancho - texto.width - margen, Math.max(margen, salida.x - texto.width / 2));
    const yLibre = Math.min(maxY, Math.max(minY, salida.y - texto.height / 2));
    const yBorde = salida.borde === "arriba" ? minY : salida.borde === "abajo" ? Math.max(minY, maxY) : yLibre;
    texto.setPosition(salida.borde === "derecha" ? ancho - texto.width - margen : salida.borde === "izquierda" ? margen : x, yBorde);
    const aCss = 1 / escala;
    window.__debug!.avisoPerdido = {
      borde: salida.borde,
      x: texto.x,
      y: texto.y,
      ancho: texto.width,
      alto: texto.height,
      css: { x: rect.left + texto.x * aCss, y: rect.top + texto.y * aCss, ancho: texto.width * aCss, alto: texto.height * aCss },
    };
    if (!movimientoReducido) {
      this.cameras.main.flash(120, 255, 209, 102, false);
    }
    const temporizador = this.time.delayedCall(DURACION_AVISO_PERDIDO_MS, () => this.retirarAvisoPerdido());
    this.avisoPerdidoVivo = { texto, temporizador };
    window.__debug!.avisosPerdidoVivos = 1;
  }

  private retirarAvisoPerdido(): void {
    const vivo = this.avisoPerdidoVivo;
    if (!vivo) return;
    vivo.temporizador.remove(false);
    vivo.texto.destroy();
    this.avisoPerdidoVivo = null;
    if (window.__debug) window.__debug.avisosPerdidoVivos = 0;
  }

  // Borde inferior (px CSS de la página) del aviso PWA visible, o 0 si no hay.
  private finAvisoPwaPx(): number {
    const aviso = document.querySelector("[data-testid='aviso-version-nueva'], [data-testid='aviso-listo-sin-conexion']");
    return aviso ? aviso.getBoundingClientRect().bottom : 0;
  }

  // vida-color: daño recibido como número flotante en el color del atacante.
  // Sin movimiento reducido no se llama. Se publica en efectosVisibles mientras
  // vive, porque el texto está en el lienzo y ningún selector de DOM lo ve.
  private mostrarNumeroDanio(x: number, y: number, danio: number, atacante: number): void {
    const escala = this.scale.displayScale.x;
    const color = colorDeAsiento(atacante);
    const texto = this.add
      .text(x, y, `-${danio}`, { fontFamily: "sans-serif", fontSize: `${Math.round(18 * escala)}px`, fontStyle: "bold", color, stroke: "#000000", strokeThickness: Math.round(3 * escala) })
      .setOrigin(0.5, 1)
      .setDepth(2000);
    // marca-asiento: la silueta del tirador delante del número, para que quién
    // ha disparado no dependa solo del color. Se centra el conjunto en x.
    const lado = Math.round(16 * escala);
    const hueco = Math.round(3 * escala);
    texto.setX(x + (lado + hueco) / 2);
    const silueta = this.add.graphics().setDepth(2000);
    silueta.lineStyle(Math.max(1, Math.round(2 * escala)), 0x0b0f1a, 1);
    silueta.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
    const contorno = contornoSiluetaAsiento(atacante).map((p) => new Phaser.Math.Vector2((p.x - 0.5) * lado, (p.y - 0.5) * lado));
    silueta.fillPoints(contorno, true);
    silueta.strokePoints(contorno, true);
    silueta.setPosition(texto.x - texto.width / 2 - hueco - lado / 2, y - texto.height / 2);
    const efecto: DebugEfectoVisible = { tipo: "numero-danio", valor: danio, color, silueta: varianteSiluetaAsiento(atacante), duracionMs: DURACION_NUMERO_DANIO_MS, x, y, radioOnda: 0, particulas: 0, escala: 0, sobre: "nave" };
    this.numerosDanioVivos.push(efecto);
    this.tweens.add({
      targets: [texto, silueta],
      y: `-=${36 * escala}`,
      alpha: 0,
      duration: DURACION_NUMERO_DANIO_MS,
      ease: "Quad.easeOut",
      onComplete: () => {
        texto.destroy();
        silueta.destroy();
        this.numerosDanioVivos = this.numerosDanioVivos.filter((e) => e !== efecto);
        this.publicarEfectosVisibles();
      },
    });
  }

  private publicarEfectosVisibles(): void {
    window.__debug!.efectosVisibles = [...this.efectosDelTurno, ...this.numerosDanioVivos, ...(this.efectosEventos?.entradasDebug() ?? [])];
  }

  private manejarEventosVisuales(
    eventos: readonly EventoSimulacion[],
    detonaciones: readonly Detonacion[],
    tirador: number = this.estado.turno,
    // remate-impacto: en el golpe decisivo el remate sustituye a la sacudida.
    sinSacudida = false,
  ): number {
    let esperaSacudidaMs = 0;
    const movimientoReducido = prefiereMovimientoReducido();
    window.__debug!.detonaciones = detonaciones;
    if (detonaciones.length > 0) {
      this.medidorFrames.marcar("impacto");
      window.__debug!.registroDetonaciones = [...(window.__debug!.registroDetonaciones ?? []), { tirador, armaId: detonaciones[0].armaId, cantidad: detonaciones.length }];
    }
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
    this.efectosDelTurno = haz ? [haz, ...explosiones] : explosiones;
    this.publicarEfectosVisibles();
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
            this.mostrarNumeroDanio(evento.x, evento.y, evento.danio, tirador);
            this.publicarEfectosVisibles();
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
          if (evento.danio > 0 && permiteMovimientoCamara(obtenerEstadoControl().sacudidaActiva, movimientoReducido)) {
            const amplitud = amplitudSacudida(evento.danio);
            this.naves[evento.impactoNave].destellarDanio(intensidadDestelloDanio(evento.danio));
            window.__debug!.ultimoRealceImpacto = { danio: evento.danio, amplitud };
            if (!sinSacudida) {
              this.sacudirCamara(DURACION_SACUDIDA_IMPACTO_MS, amplitud);
              esperaSacudidaMs = Math.max(esperaSacudidaMs, DURACION_SACUDIDA_IMPACTO_MS);
            }
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

    // remate-impacto: solo el turno animado real (el mismo que retrasa por
    // la sacudida) hace remate; los guiones de prueba avanzan síncronos.
    const destruidas = estadoDespues.naves.flatMap((nave, id) => (nave.integridad <= 0 && estadoAntes.naves[id].integridad > 0 ? [id] : []));
    const modoRemate: ModoRemate = opciones?.retrasarSiHaySacudida
      ? decidirRemate({
          navesDestruidas: destruidas.length,
          finDePartida: estadoDespues.resultado.tipo === "terminada",
          permiteMovimiento: permiteMovimientoCamara(obtenerEstadoControl().sacudidaActiva, prefiereMovimientoReducido()),
        })
      : "ninguno";
    const esperaSacudidaMs = this.manejarEventosVisuales(eventos, opciones?.detonaciones ?? [], tirador, modoRemate === "completo");
    // mrb-1: el robot que detona se retira en el mismo instante que su
    // explosión; si esperara a avanzarTurno (retrasado por la sacudida), se
    // vería el robot vivo junto a su propia explosión.
    if (eventos.some((evento) => evento.tipo === "robot-detona")) this.retirarRobotsDetonados(estadoDespues);
    this.reaccionarAHumor(eventos);
    // Cuenta como turno resuelto el que dispara (o pierde el tiro); un turno
    // de equipo no es un disparo y el que cierra la partida lo cuenta el parte.
    if ((categoriaBroma || eventos.some((evento) => evento.tipo === "disparo")) && estadoDespues.resultado.tipo !== "terminada") {
      this.narrarPartida(tirador, estadoAntes.numeroTurno, categoriaBroma, eventos, estadoDespues);
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
      this.reproducirSaltosRobot(eventos, prefiereMovimientoReducido());
      this.refrescarObjetos();
      this.refrescarUniverso(eventos);
      this.publicarTension();
      window.__debug!.turno = this.estado.turno;
      window.__debug!.numeroTurno = this.estado.numeroTurno;
      // cam-4: el turno nuevo siempre empieza en la vista completa.
      this.camaraCtl.alCambiarTurno();
      publicarTurno(this.estado.turno);
      publicarJugable(this.puedeJugarAhora());
      // Turno cerrado y aún sin vuelo ni relevo: el único momento en que el
      // estado es una foto limpia (nunca un proyectil a medias).
      this.guardarTurnoCerrado();

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
        const premios = asignarPremios(this.estadisticasAsientos);
        const tarjetas = this.estadisticasAsientos.map((estadisticasAsiento, indice) => ({
          asiento: estadisticasAsiento.asiento,
          nombre: nombreDeNave(this.controladores, estadisticasAsiento.asiento),
          premios: premios[indice],
          estadisticas: estadisticasAsiento,
        }));
        publicarParteDeGuerra(parte, estadisticasGanador, tarjetas);
        window.__debug!.parteDeGuerra = {
          ...parte,
          estadisticas: estadisticasGanador,
          premios,
          estadisticasPorAsiento: this.estadisticasAsientos,
        };
        // partida-5: intento de guardado best-effort -- si localStorage no
        // está disponible, guardarUltimaPartida se degrada en silencio (ver
        // progreso.ts) y la partida ya jugada no se pierde por eso.
        guardarUltimaPartida(parte, estadisticasGanador);
      }
      // ritmo-robot-propulsores: el turno siguiente (la IA incluida) espera a
      // que acabe de verse el vuelo o el salto.
      if (this.movimientos.length > 0 && opciones?.alAvanzarTurno) {
        this.alTerminarMovimientos = opciones.alAvanzarTurno;
        return;
      }
      opciones?.alAvanzarTurno?.();
    };

    if (modoRemate !== "ninguno") {
      const primera = destruidas[0];
      const golpe = eventos.find((e) => e.tipo === "impacto" && e.objetivo === primera);
      const nave = estadoAntes.naves[primera];
      const punto = golpe && golpe.tipo === "impacto" ? { x: golpe.x, y: golpe.y } : { x: nave.x, y: nave.y ?? this.scale.height / 2 };
      this.iniciarRemate(modoRemate, punto, avanzarTurno);
    } else if (opciones?.retrasarSiHaySacudida && esperaSacudidaMs > 0) {
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
    this.estadisticasAsientos = acumularTurno(this.estadisticasAsientos, eventos, this.trayectoriaDelTurno, {
      integridades: estadoDespues.naves.map((nave) => nave.integridad),
      pixelesDestruidos: contarPixelesDestruidos(estadoAntes.mascara, estadoDespues.mascara),
    });
    this.trayectoriaDelTurno = null;
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
    // Racha para el resumen: un disparo sin daño al rival corta la racha de
    // aciertos y suma un fallo.
    this.fallosSeguidos[tirador] = danioAlEnemigo > 0 ? 0 : (this.fallosSeguidos[tirador] ?? 0) + 1;

    this.estadisticas[tirador] = {
      disparos: previas.disparos + 1,
      fallos: previas.fallos + (fallo ? 1 : 0),
      autoimpactos: previas.autoimpactos + (autoimpacto ? 1 : 0),
      danioHechoAlEnemigo: previas.danioHechoAlEnemigo + danioAlEnemigo,
      pixelesDestruidos: previas.pixelesDestruidos + pixelesDestruidos,
    };
  }

  // remate-impacto: reloj propio movido por el delta de la escena (el mismo
  // que adelanta avanzarHastaTurnoHumano). El simulador ya resolvió el turno,
  // así que la pausa es solo de presentación.
  private iniciarRemate(modo: Exclude<ModoRemate, "ninguno">, impacto: { x: number; y: number }, alTerminar: () => void): void {
    this.finalizarRemate();
    const ancho = this.scale.width;
    const alto = this.scale.height;
    const camara = this.cameras.main;
    this.encuadreGuardadoRemate = this.camaraCtl.instantanea();
    const ctl = new ControladorRemate(modo, { x: camara.scrollX + ancho / 2, y: camara.scrollY + alto / 2 }, impacto, ancho, alto);
    const bloquea = modo === "completo";
    this.remate = { ctl, bloquea, alTerminar, congelado: false };
    const previo = window.__debug!.remate;
    window.__debug!.remate = {
      activo: true,
      completados: previo?.completados ?? 0,
      destellosCamara: [...(previo?.destellosCamara ?? []), Math.round(performance.now())],
      ultimo: {
        modo,
        x: impacto.x,
        y: impacto.y,
        duracionMs: Math.max(...ctl.plan.map((f) => f.finMs)),
        fases: ctl.plan.map((f) => ({ nombre: f.nombre, inicioMs: f.inicioMs, finMs: f.finMs })),
      },
    };
    if (!bloquea) alTerminar();
    this.aplicarFotogramaRemate(ctl.avanzar(0));
  }

  private actualizarRemate(deltaMs: number): void {
    if (!this.remate) return;
    this.aplicarFotogramaRemate(this.remate.ctl.avanzar(deltaMs));
  }

  private aplicarFotogramaRemate(f: FotogramaRemate): void {
    const remate = this.remate;
    if (!remate) return;
    if (f.terminado) {
      const { alTerminar, bloquea } = remate;
      this.finalizarRemate();
      const previo = window.__debug!.remate;
      if (previo) window.__debug!.remate = { ...previo, activo: false, completados: previo.completados + 1 };
      if (bloquea) alTerminar();
      return;
    }
    if (remate.bloquea) {
      this.camaraCtl.fijarExterno({ zoom: f.zoom, cx: f.centro.x, cy: f.centro.y });
      // Durante la pausa se retiene en su primer fotograma lo que ya estalló.
      if (f.congelado !== remate.congelado) {
        remate.congelado = f.congelado;
        if (f.congelado) {
          this.tweens.pauseAll();
          this.emisorExplosion.pause();
          this.emisorExplosionSinDanio.pause();
        } else this.reanudarTrasPausaRemate();
      }
    }
    if (!this.veloRemate) {
      this.veloRemate = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffffff).setScrollFactor(0).setDepth(5000);
    }
    this.veloRemate.setAlpha(f.alfaDestello).setVisible(f.alfaDestello > 0);
  }

  private reanudarTrasPausaRemate(): void {
    this.tweens.resumeAll();
    this.emisorExplosion.resume();
    this.emisorExplosionSinDanio.resume();
  }

  // Siempre devuelve la cámara al encuadre guardado y reanuda lo congelado,
  // también si el remate se corta: la partida nunca queda a medias.
  private finalizarRemate(): void {
    const remate = this.remate;
    this.remate = null;
    if (!remate) return;
    if (remate.congelado) this.reanudarTrasPausaRemate();
    const guardado = this.encuadreGuardadoRemate;
    this.encuadreGuardadoRemate = null;
    if (guardado) this.camaraCtl.restaurar(guardado);
    this.veloRemate?.setVisible(false);
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
      if (permiteMovimientoCamara(obtenerEstadoControl().sacudidaActiva, prefiereMovimientoReducido())) this.sacudirCamara(DURACION_SACUDIDA_MS, INTENSIDAD_SACUDIDA);
      const frase = this.selectorFrases.elegir(this.rival.id, evento.tipo);
      publicarReaccion(frase, evento.tipo);
      reproducirTono(evento.tipo);
    }
  }

  // voz-resumenes: cada tercer turno resuelto el locutor resume cómo va la
  // partida, con datos reales del estado. Es texto y voz a la vez, y el texto
  // no depende del audio: un navegador con la voz bloqueada lo muestra igual.
  private narrarPartida(
    tirador: IdNave,
    numeroTurno: number,
    categoria: CategoriaBroma | undefined,
    eventos: readonly EventoSimulacion[],
    estadoDespues: EstadoPartida,
  ): void {
    this.turnosResueltos += 1;
    const personalidadTirador = this.controladores[tirador]?.personalidad;
    const voz = personalidadTirador ? vozDeNave(1, personalidadTirador.id) : vozDeNave(0, this.rival.id);
    let resumen: string | null = null;
    if (tocaResumen(this.turnosResueltos)) {
      const elegido = resumenPartida(
        {
          asientos: estadoDespues.naves.map((nave, id) => ({
            nombre: nombreEnResumen(this.controladores, id),
            esYo: esHumanoLocalUnico(this.controladores, id),
            desplazada: eventos.some((evento) => evento.tipo === "desplazamiento" && evento.nave === id),
            integridad: nave.integridad,
            viva: nave.integridad > 0,
            fallosSeguidos: this.fallosSeguidos[id] ?? 0,
            credito: estadoDespues.saldos?.[id],
          })),
          ronda: estadoDespues.ronda ?? 1,
          recientes: this.plantillasRecientes,
        },
        this.semillaResumenes + this.turnosResueltos,
      );
      this.plantillasRecientes = [...this.plantillasRecientes, elegido.plantilla].slice(-MEMORIA_PLANTILLAS);
      resumen = elegido.texto;
      publicarResumen(numeroTurno, resumen, tirador);
      // Durante el relevo la pantalla tapa el juego y no debe hablar nadie.
      if (!this.relevoPendiente) obtenerLocutor().hablar(voz, resumen);
    }
    window.__debug!.historialBromas = [
      ...(window.__debug!.historialBromas ?? []),
      { numeroTurno, tirador, voz, categoria, resumen, eventos },
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
    const recorridos: { nave: number; puntos: readonly { x: number; y: number }[]; motivoParada: string }[] = [];
    for (const evento of eventos) {
      if (evento.tipo === "nave-asentada") {
        // Sin marca «Estaba aquí»: no es un empuje que el jugador deba leer,
        // solo la nave apoyándose fuera del sólido. Si ese mismo turno ya se
        // desliza por otro motivo, espera a que termine para no pisarlo.
        if (movimientoReducido) continue;
        const nave = this.naves[evento.nave];
        const desdeY = alturaRenderNave(evento.desdeY, evento.desdeY);
        const haciaY = alturaRenderNave(evento.y, evento.y);
        const vuelo = eventos.find((otro): otro is Extract<EventoSimulacion, { tipo: "propulsores" }> => otro.tipo === "propulsores" && otro.nave === evento.nave);
        const yaSeDesliza = vuelo !== undefined || eventos.some((otro) => otro.tipo === "desplazamiento" && otro.nave === evento.nave);
        const esperaMs = vuelo ? duracionPropulsoresMs(longitudDeRuta(vuelo.puntos), false) : DURACION_DESLIZAMIENTO_MS;
        const progreso = { t: 0 };
        if (!yaSeDesliza) nave.posicionarEn(evento.desdeX, desdeY);
        this.tweens.add({
          targets: progreso,
          t: 1,
          delay: yaSeDesliza ? esperaMs : 0,
          duration: DURACION_DESLIZAMIENTO_MS,
          ease: "Sine.easeInOut",
          onStart: () => nave.posicionarEn(evento.desdeX, desdeY),
          onUpdate: () => nave.posicionarEn(evento.desdeX + (evento.x - evento.desdeX) * progreso.t, desdeY + (haciaY - desdeY) * progreso.t),
          onComplete: () => nave.posicionarEn(evento.x, haciaY),
        });
        continue;
      }
      if (evento.tipo !== "desplazamiento" && evento.tipo !== "propulsores") continue;
      if (evento.tipo === "desplazamiento" && evento.reserva === "se-queda") continue;
      if (evento.tipo === "propulsores" && evento.desdeX === evento.x && evento.desdeY === evento.y) continue;
      if (evento.tipo === "propulsores") {
        this.reproducirPropulsores(evento, movimientoReducido);
        // La marca «Estaba aquí» sigue saliendo como con cualquier desplazamiento.
        const desdeYMarca = alturaRenderNave(evento.desdeY, evento.desdeY);
        const marca = this.add.graphics().setDepth(29);
        marca.lineStyle(4, 0xffffff, 0.7).strokeCircle(evento.desdeX, desdeYMarca, RADIO_MARCA_FANTASMA_U);
        const etiqueta = this.add
          .text(evento.desdeX, desdeYMarca + RADIO_MARCA_FANTASMA_U + 6, "Estaba aquí", { fontSize: `${TAMANO_TEXTO_FANTASMA_PX}px`, color: "#ffffff" })
          .setOrigin(0.5, 0)
          .setAlpha(0.8)
          .setDepth(29);
        this.marcasFantasma.push(marca, etiqueta);
        fantasmas.push({ nave: evento.nave, x: evento.desdeX, y: desdeYMarca });
        continue;
      }
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
      // La nave sigue los mismos puntos que calculó el núcleo (curva por la
      // gravedad, deslizamiento por el borde), no una recta de origen a destino.
      const camino = evento.puntos;
      recorridos.push({ nave: evento.nave, puntos: evento.puntos, motivoParada: evento.motivoParada });

      if (movimientoReducido) continue;
      nave.posicionarEn(evento.desdeX, desdeY);
      const progreso = { t: 0 };
      this.tweens.add({
        targets: progreso,
        t: 1,
        duration: DURACION_DESLIZAMIENTO_MS,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          const punto = puntoDelRecorrido(camino, progreso.t);
          nave.posicionarEn(punto.x, punto.y);
        },
        onComplete: () => nave.posicionarEn(evento.x, haciaY),
      });
    }
    window.__debug!.fantasmas = fantasmas;
    window.__debug!.recorridoEmpuje = recorridos;
    publicarFantasmas(
      fantasmas.map(({ nave }) => ({
        nave,
        texto: textoDesplazamiento(nombreEnResumen(this.controladores, nave), esHumanoLocalUnico(this.controladores, nave)),
      })),
    );
  }

  // ritmo-robot-propulsores: la nave ya está en su destino en el estado; aquí
  // se reproduce el vuelo a 300 u/s (1,5-3 s) con aceleración y frenada, y la
  // ruta punteada se va borrando por detrás. __debug.reproduccion publica la
  // posición pintada para que el e2e la muestree sin depender de capturas.
  private reproducirPropulsores(evento: Extract<EventoSimulacion, { tipo: "propulsores" }>, reducido: boolean): void {
    const nave = this.naves[evento.nave];
    const camino = evento.puntos.map((punto) => ({ x: punto.x, y: alturaRenderNave(punto.y, punto.y) }));
    const duracionMs = duracionPropulsoresMs(longitudDeRuta(camino), reducido);
    const ruta = this.add.graphics().setDepth(29);
    const grosor = ANCHO_MIRA_CSS_PX * this.scale.displayScale.x;
    const pintar = (t: number): void => {
      const punto = puntoDelRecorrido(camino, t);
      nave.posicionarEn(punto.x, punto.y);
      ruta.clear().lineStyle(grosor, 0xffd23f, 0.95);
      // Solo lo que queda por recorrer: la parte ya volada se borra.
      const recorrida = longitudDeRuta(camino) * t;
      let acumulado = 0;
      for (let i = 1; i < camino.length; i++) {
        const largo = Math.hypot(camino[i].x - camino[i - 1].x, camino[i].y - camino[i - 1].y);
        acumulado += largo;
        if (acumulado <= recorrida || i % 2 === 0) continue;
        ruta.lineBetween(camino[i - 1].x, camino[i - 1].y, camino[i].x, camino[i].y);
      }
      this.publicarReproduccion({ nave: evento.nave, x: punto.x, y: punto.y });
    };
    pintar(0);
    this.encolarMovimiento({
      duracionMs,
      aplicar: (ms) => pintar(easeInOut(ms / duracionMs)),
      terminar: () => {
        ruta.destroy();
        nave.posicionarEn(evento.x, alturaRenderNave(evento.y, evento.y));
        this.publicarReproduccion(undefined);
      },
    });
    window.__debug!.duracionPropulsoresMs = duracionMs;
  }

  // ritmo-robot-propulsores (rit-2): cada salto es realce (300 ms), arco
  // (1100 ms) y pausa al aterrizar (300 ms). El robot del estado ya está en
  // el destino; mientras dura la reproducción se pinta aparte el que viaja.
  private reproducirSaltosRobot(eventos: readonly EventoSimulacion[], reducido: boolean): void {
    const saltos = eventos.filter((evento): evento is Extract<EventoSimulacion, { tipo: "robot-salta" }> => evento.tipo === "robot-salta");
    if (saltos.length === 0) return;
    const escala = reducido ? 0.5 : 1;
    // Todos los saltos de un mismo inicio de turno corren a la vez.
    const duracionMs = duracionSaltosMs(1, reducido);
    this.dibujarRobots(this.estado.robots ?? [], new Set(saltos.map((salto) => `${salto.x},${salto.y}`)));
    const cuerpo = this.add.graphics().setDepth(28);
    const contadores = saltos.map(() => this.add.text(0, 0, "", { fontSize: `${TAMANO_TEXTO_FANTASMA_PX}px`, color: "#ffffff" }).setOrigin(0.5, 1).setDepth(28));
    const pintar = (ms: number): void => {
      cuerpo.clear();
      const robotsDebug: { dueno: number; x: number; y: number; fase: string }[] = [];
      saltos.forEach((salto, indice) => {
        const muestra = muestraDeSalto({ x: salto.desdeX, y: alturaRenderNave(salto.desdeY, salto.desdeY) }, { x: salto.x, y: alturaRenderNave(salto.y, salto.y) }, ms, escala);
        const radio = RADIO_ROBOT_U * (1 + 0.35 * (muestra.fase === "realce" ? Math.sin(Math.PI * muestra.realce) : 0));
        if (muestra.fase === "realce") cuerpo.lineStyle(4, 0xffd23f, 0.9).strokeCircle(muestra.x, muestra.y - RADIO_ROBOT_U, RADIO_ROBOT_U * (1.4 + 0.8 * muestra.realce));
        cuerpo.fillStyle(0xe8743b, 1).fillCircle(muestra.x, muestra.y - RADIO_ROBOT_U, radio);
        cuerpo.lineStyle(3, 0xffffff, 0.9).strokeCircle(muestra.x, muestra.y - RADIO_ROBOT_U, radio);
        contadores[indice].setPosition(muestra.x, muestra.y - 2 * RADIO_ROBOT_U - 4).setText(`${salto.saltos}/${MAX_SALTOS_ROBOT}`);
        robotsDebug.push({ dueno: salto.nave, x: muestra.x, y: muestra.y, fase: muestra.fase });
      });
      window.__debug!.reproduccion = { ...(window.__debug!.reproduccion ?? { activa: true, naves: [] }), activa: true, robots: robotsDebug };
    };
    pintar(0);
    this.encolarMovimiento({
      duracionMs,
      aplicar: pintar,
      terminar: () => {
        cuerpo.destroy();
        for (const contador of contadores) contador.destroy();
        this.refrescarRobots();
        window.__debug!.reproduccion = { activa: true, naves: window.__debug!.reproduccion?.naves ?? [], robots: [] };
      },
    });
    window.__debug!.duracionSaltoRobotMs = duracionMs;
  }

  private encolarMovimiento(movimiento: { duracionMs: number; aplicar: (ms: number) => void; terminar: () => void }): void {
    this.movimientos.push({ transcurridoMs: 0, ...movimiento });
  }

  private publicarReproduccion(nave: { nave: number; x: number; y: number } | undefined): void {
    const previa = window.__debug!.reproduccion;
    const naves = nave ? [...(previa?.naves ?? []).filter((otra) => otra.nave !== nave.nave), nave] : [];
    window.__debug!.reproduccion = { activa: nave !== undefined, naves, robots: previa?.robots ?? [] };
  }

  private avanzarMovimientos(delta: number): void {
    if (this.movimientos.length === 0) return;
    const vivos: typeof this.movimientos = [];
    for (const movimiento of this.movimientos) {
      movimiento.transcurridoMs += delta;
      if (movimiento.transcurridoMs >= movimiento.duracionMs) {
        movimiento.aplicar(movimiento.duracionMs);
        movimiento.terminar();
      } else {
        movimiento.aplicar(movimiento.transcurridoMs);
        vivos.push(movimiento);
      }
    }
    this.movimientos = vivos;
    // `ms` es el reloj de la escena (el del delta), no el de pared: con el WebGL
    // por software un frame tarda mucho más que su delta y solo el reloj de la
    // escena dice cuánto de la animación se ha reproducido.
    window.__debug!.reproduccion = { naves: [], robots: [], ...window.__debug!.reproduccion, activa: vivos.length > 0, ms: Math.max(0, ...vivos.map((m) => m.transcurridoMs)) };
    if (vivos.length === 0 && this.alTerminarMovimientos) {
      const siguiente = this.alTerminarMovimientos;
      this.alTerminarMovimientos = null;
      siguiente();
    }
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
      this.sincronizarFantasma(indice, naveEstado.integridad, y);
    }
    this.publicarFantasmasNave();
  }

  // fan-1: al llegar a 0 la nave deja paso a su fantasma (refrescarNaves se
  // llama al terminar la explosión, no antes). Es solo dibujo: el núcleo ya
  // excluye las naves muertas de la colisión (fan-2).
  private sincronizarFantasma(indice: number, integridad: number, y: number): void {
    const existente = this.fantasmasNave.get(indice);
    if (integridad > 0) {
      if (existente) {
        existente.destruir();
        this.fantasmasNave.delete(indice);
      }
      this.naves[indice].mostrar(true);
      return;
    }
    this.naves[indice].mostrar(false);
    if (existente) return;
    this.fantasmasNave.set(
      indice,
      new FantasmaNave(this, {
        idNave: indice,
        nombre: nombreDeNave(this.controladores, indice),
        color: COLORES_NAVE[indice] ?? COLORES_NAVE[0],
        puntos: this.naves[indice].obtenerPuntosSilueta(),
        x: this.estado.naves[indice].x,
        y,
        movimientoReducido: prefiereMovimientoReducido(),
      }),
    );
  }

  private publicarFantasmasNave(): void {
    window.__debug!.fantasmasNave = [...this.fantasmasNave.entries()].map(([nave, f]) => ({
      nave,
      nombre: f.nombre,
      alfa: f.obtenerAlfa(),
      x: f.obtenerPosicion().x,
      y: f.obtenerPosicion().y,
      yVisible: f.obtenerYVisible(),
      texturaValida: f.texturaValida(),
    }));
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

  private dibujarRobots(robots: readonly EstadoRobot[], ocultos?: ReadonlySet<string>): void {
    for (const marca of this.marcasRobot) marca.destroy();
    this.marcasRobot = [];
    for (const robot of robots) {
      if (ocultos?.has(`${robot.x},${robot.y}`)) continue;
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
    // Los cuerpos también cuentan en efectosVisibles desde que existen, no solo
    // al cerrar un turno: lo que se ve tiene que ser lo que hay en el estado.
    this.efectosEventos?.sincronizar(this.datosParaEventos());
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
        texto: objeto.tipo === "corazon" ? `Corazón galáctico: +${VIDA_CORAZON} de vida si toca tu nave` : `Tormenta solar: −${VIDA_TORMENTA} de vida si toca tu nave`,
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

  // musica-tension: las señales salen del estado que la escena ya tiene; un
  // cierre de turno = una llamada (la histéresis cuenta cierres).
  private publicarTension(): void {
    const estado = this.estado;
    const vivas = estado.naves.filter((nave) => nave.integridad > 0);
    actualizarTension({
      muerteSubita: estado.ronda !== undefined && (estado.muerteSubita === true || estado.ronda >= RONDA_MUERTE_SUBITA - 1),
      integridadesVivas: vivas.map((nave) => (nave.integridad / INTEGRIDAD_MAXIMA) * 100),
      vivas: vivas.length,
    });
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
      if (evento.tipo !== "muerte-subita") continue;
      this.anunciar(evento.fase === "drenaje" ? anuncioMuerteSubitaDrenaje(evento.danio) : anuncioMuerteSubitaAviso(), null, 0);
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
      this.anunciar(anuncioDeEvento(evento.evento as TipoEvento), definicion.alcance === "nave" ? evento.nave : null, evento.nave);
    }
    this.mostrarEfectosDeEventos(eventos);
  }

  // anu-1: cartel en cola, entrada en el histórico y, con la voz activa, lectura
  // con prioridad sobre los resúmenes. `afectado` es null cuando cae sobre todos;
  // `emisor` es el asiento que firma la entrada del histórico.
  private anunciar(anuncio: AnuncioEvento, afectado: number | null, emisor: number): void {
    const quien = afectado === null ? null : { nombre: nombreDeNave(this.controladores, afectado), color: colorDeAsiento(afectado) };
    publicarCartel({ titulo: anuncio.titulo, quien, texto: anuncio.explicacion });
    publicarAnuncioHistorico(this.turnosResueltos, `${anuncio.titulo}. ${anuncio.explicacion}`, emisor);
    // Durante el relevo la pantalla tapa el juego y no debe hablar nadie.
    if (this.relevoPendiente) return;
    const personalidad = this.controladores[emisor]?.personalidad;
    const voz = personalidad ? vozDeNave(1, personalidad.id) : vozDeNave(0, this.rival.id);
    obtenerLocutor().hablar(voz, textoLocutado(anuncio, quien?.nombre ?? "Todos"), true);
  }

  // eventos-visibles: lo que ve el jugador de cada evento, además del cartel.
  // Los persistentes se cuadran contra EstadoUniverso en cada refresco; los
  // instantáneos y los del contacto de un objeto se lanzan con el evento del núcleo.
  private mostrarEfectosDeEventos(eventos: readonly EventoSimulacion[]): void {
    const datos = this.datosParaEventos();
    this.efectosEventos.sincronizar(datos);
    for (const evento of eventos) {
      if (evento.tipo === "evento-universo" && evento.perdido !== true) this.efectosEventos.disparar(evento.evento as TipoEvento, evento.nave, datos);
      else if (evento.tipo === "objeto-alcanza") {
        if (evento.objeto === "corazon") this.efectosEventos.destelloCuracion(evento.nave, evento.cambio, datos);
        else this.efectosEventos.descargaTormenta(evento.nave, evento.cambio, datos);
      }
    }
  }

  private datosParaEventos(): DatosEventos {
    const estado = this.estado;
    return {
      universo: estado.universo,
      naves: estado.naves.map((nave) =>
        nave.integridad <= 0 ? null : { x: nave.x, y: alturaRenderNave(nave.y, alturaSuperficie(estado.mascara, nave.x) ?? estado.mundo.alto - 1) },
      ),
      objetos: (estado.universo?.objetos ?? []).map((objeto) => ({ id: objeto.id, x: objeto.x, y: objeto.y })),
      planetas: (estado.planetas ?? []).map((planeta) => ({ id: planeta.id, x: planeta.cx, y: planeta.cy, radio: planeta.radio })),
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      mundoPorCss: this.scale.displayScale.x,
    };
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

  // El tablero queda a la vista al cerrar la ayuda inicial o, si no se
  // muestra, en el primer turno del jugador: con la ayuda encima los 4 s
  // pasarían sin que nadie viera el rótulo.
  private actualizarRotuloDeriva(): void {
    const ahora = performance.now();
    const delta = this.instanteAnteriorRotulo === null ? 0 : Math.min(ahora - this.instanteAnteriorRotulo, 1000);
    this.instanteAnteriorRotulo = ahora;
    const control = obtenerEstadoControl();
    if (control.ayudaVisible) this.ayudaInicialVista = true;
    const tableroAlaVista = !control.ayudaVisible && (this.ayudaInicialVista || control.puedeDisparar);
    if (tableroAlaVista) {
      this.ayudaInicialVista = true;
      this.msTableroVisible += delta;
    }
    const alfa = alfaRotuloDeriva({
      modoEspacial: control.modoEspacial,
      deriva: this.estado.mundo.deriva,
      msVisible: this.msTableroVisible,
      reducirMovimiento: prefiereMovimientoReducido(),
    });
    if (alfa !== this.alfaRotulo) {
      this.alfaRotulo = alfa;
      this.indicadorDeriva.fijarAlfa(alfa);
      this.refrescarIndicadorDeriva();
    }
    window.__debug!.indicadorDeriva = {
      visible: alfa > 0,
      alfa,
      etiqueta: this.estado.mundo.etiquetaDeriva,
      msVisible: this.msTableroVisible,
    };
  }

  private refrescarIndicadorDeriva(): void {
    const dibujado = this.indicadorDeriva.actualizar(this.estado.mundo.deriva, this.estado.mundo.etiquetaDeriva);
    window.__debug!.deriva = dibujado;
  }

  // render-2, render-5: juega N turnos reales con la misma avanzar() que un
  // jugador, sin animación -- el test no depende de esperar fotogramas, solo
  // del estado ya resuelto.
  private jugarTurnosGuionizados(numero: number): void {
    // Una fuente por asiento, alternando las dos IA de siempre: con 1 contra 2
    // o 1 contra 3 el motor pide fuentes[turno] para cada nave viva.
    const fuentes = this.estado.naves.map((_, asiento) => crearFuenteIA(asiento % 2 === 0 ? LA_CONTABLE : ALMIRANTE_BISAGRA));

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
      // Un tiro cuyo vértice pasa del borde superior se pierde por arriba
      // (salida-pantalla): se prefiere la raíz que cabe en pantalla.
      const g = estado.mundo.gravedad * GRAVEDAD_REFERENCIA_PX_S2;
      const v = velocidadDesdePotencia(fraccionPotencia);
      const cabe = soluciones.find((s) => {
        const vy = v * Math.sin((s.anguloGrados * Math.PI) / 180);
        return (vy * vy) / (2 * g) <= origenCanonY - MARGEN_VERTICE_SOLUCION_PX;
      });
      if (cabe !== undefined) return cabe;
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
    // El tope de turnos se calculó con una vida máxima de 100: con 150 el
    // autodaño de Despedida no la agota a tiempo y la secuencia animada en
    // tiempo real superaba el timeout del e2e de escritorio.
    this.estado = {
      ...this.estado,
      naves: this.estado.naves.map((nave) => ({ ...nave, integridad: Math.min(nave.integridad, VIDA_BASE_TOPE_DESENLACE) })),
    };
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
