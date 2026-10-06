import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { costeArma } from "@/sim/partida/economia";
import { buscarEquipo, type IdEquipo } from "@/sim/equipo/catalogo";
import type { EntradaDeTurno, IdNave, ModoJuego } from "@/sim/partida/tipos";
import {
  ANGULO_INICIAL_GRADOS,
  POTENCIA_INICIAL,
  anguloConPasoFino,
  anguloDesdeFraccionControl,
  clampAngulo,
  clampPotencia,
  anguloTrasArrastre,
  potenciaConPasoFino,
  potenciaDesdeFraccionControl,
  potenciaTrasArrastre,
  sanearAjusteNumericoGuardado,
  type FraccionDeVentana,
} from "@/juego/control/apuntado";
import { UMBRAL_POTENCIA_DISPERSION_VISIBLE } from "@/sim/balistica/dispersionPotencia";
import { alternarMusica, alternarSonido, musicaActivada, sonidoSilenciado } from "@/juego/audio/motor";

// Puente entre React (ControlHUD, fuera del lienzo) y la escena de Phaser
// (que sí sabe de terreno y física): un módulo-singleton con
// suscribir/publicar, siguiendo la regla del diseño de que el control que no
// necesita saber dónde está el terreno vive fuera del lienzo. Disparar SÍ lo
// necesita, así que aquí solo se guarda la intención (`ajuste`) y quien la
// resuelve es el manejador que registra Partida.ts.
export interface EstadoAjuste {
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly armaId: string;
}

export interface EstadoControl {
  readonly ajuste: EstadoAjuste;
  readonly usosPorArma: Readonly<Record<string, number>>;
  readonly ultimoDisparo: EstadoAjuste | null;
  // Publicado por la escena: turno del jugador, partida en curso y sin
  // animación de vuelo -- el HUD no reimplementa esa condición por su cuenta.
  readonly puedeDisparar: boolean;
  readonly ayudaVisible: boolean;
  // potencia-dispersion (pot-6): texto de ayuda aparte de la ayuda inicial
  // -- avisa la PRIMERA vez que la potencia cruza el umbral donde la
  // dispersión empieza a notarse, y ya no en los turnos siguientes de esta
  // misma partida (ayudaDispersionYaMostrada, módulo-privado, se resetea en
  // reiniciarControl igual que el resto del estado de partida).
  readonly ayudaDispersionVisible: boolean;
  // render-espacio: qué frase extra añade la ayuda inicial (planetas,
  // trayectoria curva) -- lo fija la escena en create(), antes de que el
  // HUD pinte el primer fotograma.
  readonly modoEspacial: boolean;
  // modos-y-presupuesto: modo de la partida en curso y saldo del jugador --
  // fijados por Partida.ts al crear la partida (fijarModo) y refrescados tras
  // cada turno (publicarEconomia). saldo es null en barra libre (modo-4: ningún
  // saldo, ni siquiera uno enorme).
  readonly modo: ModoJuego;
  readonly saldo: number | null;
  // realce-impacto (rlc-3): si la sacudida de cámara y el destello de daño
  // están activados -- persistido como ayudaVisible (localStorage, no se
  // resetea en reiniciarControl porque es preferencia del navegador, no de
  // la partida).
  readonly sacudidaActiva: boolean;
  // sonido-procedimental (snd-1): espejo de motor.ts/sonidoSilenciado() para
  // que el HUD (React) se reactive al alternar -- motor.ts sigue siendo la
  // única fuente de verdad y la que persiste en localStorage; este campo solo
  // evita que ControlHUD tenga que leer un módulo imperativo fuera de su
  // ciclo de render.
  readonly silenciado: boolean;
  // banda-sonora: espejo de motor.ts/musicaActivada(), igual que silenciado.
  readonly musicaActiva: boolean;
  // hud-canales-1/2: de quién es el turno, para el canal de estado -- la
  // escena ya lo sabía (window.__debug.turno, solo para e2e); esto es lo
  // mismo pero reactivo para la UI real. nombreRival llega una sola vez por
  // partida (la personalidad no cambia a media partida), de ahí que no haga
  // falta un "nombresPorNave" todavía -- IdNave sigue siendo 0|1 a propósito
  // (ver sim/partida/tipos.ts), así que el canal de estado pinta solo esas
  // dos y reserva sitio visual para hasta cuatro sin fingir que ya existen.
  readonly turno: IdNave;
  readonly nombreRival: string;
  // apuntado-y-relevo (apu-6): ayuda de una línea sobre el apuntado directo.
  // Solo se ve en el primer turno de cada asiento y se puede cerrar.
  readonly ayudaApuntadoVisible: boolean;
  // apuntado-y-relevo (apu-4): true desde que se monta la partida hasta que
  // la escena termina de colocar las naves (con 3-4 naves son 4-9 s).
  readonly preparando: boolean;
  // escudo-y-propulsores: equipo elegido en la pestaña «Equipo». Con uno
  // elegido, el botón de acción lo usa en vez de disparar; elegir un arma lo
  // suelta. No se persiste: es una intención de este turno.
  readonly equipoId: IdEquipo | null;
  // Turnos que le quedan al escudo del jugador al que le toca (0 = sin
  // escudo): deshabilita «Activar escudo» mientras esté puesto.
  readonly escudoPropioTurnos: number;
}

const CLAVE_AYUDA_VISTA = "control-apuntado:ayuda-vista";

function ayudaYaVista(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_AYUDA_VISTA) === "1";
  } catch {
    return false;
  }
}

function marcarAyudaVista(): void {
  try {
    window.localStorage.setItem(CLAVE_AYUDA_VISTA, "1");
  } catch {
    // Almacenamiento no disponible (navegación privada, cuota agotada...):
    // la ayuda volverá a aparecer la próxima vez, que es un fallo visible y
    // sin consecuencias, no una excepción sin capturar.
  }
}

// ctl-6: el ajuste sobrevive a recargar la página (localStorage), no solo al
// cambio de turno en memoria -- un valor corrupto o de una partida vieja con
// otro catálogo de armas nunca debe impedir arrancar, de ahí el saneado en
// dos pasos (numérico en apuntado.ts, armaId contra el catálogo aquí, que es
// el único de los dos módulos que lo conoce).
const CLAVE_AJUSTE_GUARDADO = "control-apuntado:ajuste";

function leerAjusteGuardado(): EstadoAjuste | null {
  try {
    const bruto = window.localStorage.getItem(CLAVE_AJUSTE_GUARDADO);
    if (!bruto) return null;
    const datos: unknown = JSON.parse(bruto);
    const numerico = sanearAjusteNumericoGuardado(datos);
    if (!numerico) return null;
    const armaIdBruto = (datos as Record<string, unknown>).armaId;
    const armaId =
      typeof armaIdBruto === "string" && CATALOGO_ARMAS.some((arma) => arma.id === armaIdBruto)
        ? armaIdBruto
        : CATALOGO_ARMAS[0].id;
    return { ...numerico, armaId };
  } catch {
    return null;
  }
}

function guardarAjuste(ajuste: EstadoAjuste): void {
  try {
    window.localStorage.setItem(CLAVE_AJUSTE_GUARDADO, JSON.stringify(ajuste));
  } catch {
    // Cuota agotada o almacenamiento no disponible: el ajuste no persiste
    // entre turnos, un fallo visible y sin consecuencias, no una excepción
    // sin capturar.
  }
}

// realce-impacto (rlc-3): "no marea ni estorba" -- por defecto activada
// (true cuando no hay nada guardado todavía), igual que el resto de
// ajustes de este bloque, sin forzar al jugador a descubrir un interruptor
// para ver el efecto nuevo la primera vez.
const CLAVE_SACUDIDA_ACTIVA = "realce-impacto:sacudida-activa";

function leerSacudidaActivaGuardada(): boolean {
  try {
    const bruto = window.localStorage.getItem(CLAVE_SACUDIDA_ACTIVA);
    return bruto === null ? true : bruto === "1";
  } catch {
    return true;
  }
}

function guardarSacudidaActiva(valor: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_SACUDIDA_ACTIVA, valor ? "1" : "0");
  } catch {
    // Cuota agotada o almacenamiento no disponible: el ajuste no persiste
    // entre partidas, un fallo visible y sin consecuencias, no una
    // excepción sin capturar.
  }
}

let estado: EstadoControl = {
  ajuste: leerAjusteGuardado() ?? {
    anguloGrados: ANGULO_INICIAL_GRADOS,
    potencia: POTENCIA_INICIAL,
    armaId: CATALOGO_ARMAS[0].id,
  },
  usosPorArma: {},
  ultimoDisparo: null,
  puedeDisparar: false,
  ayudaVisible: !ayudaYaVista(),
  ayudaDispersionVisible: false,
  modoEspacial: false,
  modo: "barra-libre",
  saldo: null,
  sacudidaActiva: leerSacudidaActivaGuardada(),
  silenciado: sonidoSilenciado(),
  musicaActiva: musicaActivada(),
  turno: 0,
  nombreRival: "Rival",
  ayudaApuntadoVisible: false,
  preparando: true,
  equipoId: null,
  escudoPropioTurnos: 0,
};

// apuntado-y-relevo (apu-3): ángulo y potencia por asiento, para que el
// relevo no entregue al jugador siguiente el apuntado del anterior. Vive
// fuera de EstadoControl: ningún suscriptor lo lee, solo publicarTurno.
const APUNTADO_INICIAL = { anguloGrados: ANGULO_INICIAL_GRADOS, potencia: POTENCIA_INICIAL };
const apuntadoPorAsiento = new Map<IdNave, { anguloGrados: number; potencia: number }>();
// Asientos que ya han jugado un turno con la ayuda a la vista, o que la
// cerraron: no se les vuelve a enseñar en esta partida.
const asientosConAyudaApuntadoVista = new Set<IdNave>();

const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoControl>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

// potencia-dispersion (pot-6): una sola vez por partida -- a diferencia de
// ayudaVisible (persistida en localStorage, "ya la vio en este navegador"),
// esto vive solo en memoria y se resetea en reiniciarControl, porque el
// umbral es información de ESTA partida, no una preferencia del navegador.
let ayudaDispersionYaMostrada = false;

// Todo cambio de ajuste que venga de una acción del jugador (arrastre, paso
// fino, elegir arma, repetir disparo) pasa por aquí para persistirlo de
// golpe -- reiniciarControl() no la usa a propósito, porque una partida
// nueva sí debe volver a los valores por defecto (ver su comentario).
function fijarAjuste(cambios: Partial<EstadoAjuste>): void {
  const ajuste = { ...estado.ajuste, ...cambios };
  const cruzaUmbralDispersion =
    !ayudaDispersionYaMostrada &&
    estado.ajuste.potencia < UMBRAL_POTENCIA_DISPERSION_VISIBLE &&
    ajuste.potencia >= UMBRAL_POTENCIA_DISPERSION_VISIBLE;
  if (cruzaUmbralDispersion) {
    ayudaDispersionYaMostrada = true;
  }
  apuntadoPorAsiento.set(estado.turno, { anguloGrados: ajuste.anguloGrados, potencia: ajuste.potencia });
  fijar({ ajuste, ...(cruzaUmbralDispersion ? { ayudaDispersionVisible: true } : {}) });
  guardarAjuste(ajuste);
}

export function obtenerEstadoControl(): EstadoControl {
  return estado;
}

export function suscribirControl(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function armaEstaAgotada(armaId: string): boolean {
  const arma = CATALOGO_ARMAS.find((candidata) => candidata.id === armaId);
  if (!arma || arma.usosMaximos === undefined) return false;
  return (estado.usosPorArma[armaId] ?? 0) >= arma.usosMaximos;
}

// Sesión de arrastre: vive fuera de EstadoControl a propósito -- ningún
// suscriptor necesita re-renderizar por el punto de inicio en sí, solo por
// el ajuste que produce, y guardarlo en el estado publicado obligaría a
// limpiarlo con un valor especial en vez de con la ausencia de campo.
let arrastreEnCurso: { fraccionInicio: FraccionDeVentana; ajusteInicio: EstadoAjuste } | null = null;

export function iniciarArrastre(fraccion: FraccionDeVentana): void {
  arrastreEnCurso = { fraccionInicio: fraccion, ajusteInicio: estado.ajuste };
}

export function actualizarArrastre(fraccion: FraccionDeVentana): void {
  if (!arrastreEnCurso) return;
  const { fraccionInicio, ajusteInicio } = arrastreEnCurso;
  fijarAjuste({
    anguloGrados: anguloTrasArrastre(ajusteInicio.anguloGrados, fraccionInicio, fraccion),
    potencia: potenciaTrasArrastre(ajusteInicio.potencia, fraccionInicio, fraccion),
  });
}

export function terminarArrastre(): void {
  arrastreEnCurso = null;
}

// control-angulo-potencia: los dos controles nuevos (ver ControlHUD) mapean
// la posición del dedo DENTRO de su propio elemento directamente a todo el
// rango de su eje (ver anguloDesdeFraccionControl/potenciaDesdeFraccionControl
// en apuntado.ts) -- por eso, a diferencia del arrastre combinado de arriba,
// no hace falta guardar un punto de inicio: cada evento de puntero, por sí
// solo, ya dice dónde debe quedar el eje. Esto es lo que garantiza ctl-1 (el
// otro eje ni se menciona) y ctl-2 (un extremo a otro del control cubre todo
// el rango en un único gesto).
export function fijarAnguloDesdeFraccion(fraccion: number): void {
  fijarAjuste({ anguloGrados: anguloDesdeFraccionControl(fraccion) });
}

export function fijarPotenciaDesdeFraccion(fraccion: number): void {
  fijarAjuste({ potencia: potenciaDesdeFraccionControl(fraccion) });
}

export function ajustarAnguloFino(sentido: 1 | -1): void {
  fijarAjuste({ anguloGrados: anguloConPasoFino(estado.ajuste.anguloGrados, sentido) });
}

export function ajustarPotenciaFino(sentido: 1 | -1): void {
  fijarAjuste({ potencia: potenciaConPasoFino(estado.ajuste.potencia, sentido) });
}

// Créditos que faltan para pagar el arma con el saldo actual (0 si alcanza o
// si no hay presupuesto).
export function armaFaltaSaldo(armaId: string): number {
  if (estado.modo !== "presupuesto" || estado.saldo === null) return 0;
  return Math.max(0, costeDeArma(armaId) - estado.saldo);
}

export function equipoFaltaSaldo(id: IdEquipo): number {
  if (estado.modo !== "presupuesto" || estado.saldo === null) return 0;
  return Math.max(0, buscarEquipo(id).coste - estado.saldo);
}

// Un equipo que no se puede usar ahora mismo, con el motivo que se le enseña
// al jugador en la celda (esc-4): null si se puede elegir.
export function motivoEquipoNoDisponible(id: IdEquipo): string | null {
  const faltan = equipoFaltaSaldo(id);
  return faltan > 0 ? `Te faltan ${faltan} cr` : null;
}

// El escudo se puede elegir aunque ya esté puesto (la celda explica qué hace),
// pero no activar de nuevo: el botón de acción dice por qué está apagado.
export function equipoYaActivo(id: IdEquipo | null): boolean {
  return id === "escudo" && estado.escudoPropioTurnos > 0;
}

export function seleccionarEquipo(id: IdEquipo): void {
  if (motivoEquipoNoDisponible(id) !== null) return;
  fijar({ equipoId: id });
}

export function publicarEscudoPropio(turnos: number): void {
  if (estado.escudoPropioTurnos !== turnos) fijar({ escudoPropioTurnos: turnos });
}

export function costeDeArma(armaId: string): number {
  const arma = CATALOGO_ARMAS.find((candidata) => candidata.id === armaId);
  return arma ? costeArma(arma) : 0;
}

// Seleccionar o cambiar de arma nunca cobra (se paga al disparar), pero tampoco
// se deja seleccionar una de pago que el saldo no cubre: dispararía en vacío.
export function seleccionarArma(armaId: string): void {
  if (armaEstaAgotada(armaId)) return;
  if (armaFaltaSaldo(armaId) > 0) return;
  if (estado.equipoId !== null) fijar({ equipoId: null });
  fijarAjuste({ armaId });
}

// Partida.ts las llama al crear la partida (fijarModo, una vez) y tras cada
// turno resuelto (publicarSaldo) -- mismo patrón que fijarModoEspacial.
export function fijarModo(modo: ModoJuego, saldoInicial: number | null): void {
  fijar({ modo, saldo: saldoInicial });
}

// Si el arma seleccionada deja de ser pagable (se acaba de gastar el saldo),
// salta a la primera gratis para que Disparar nunca apunte a algo imposible.
export function publicarEconomia(saldo: number | null): void {
  const sinSaldo = saldo !== null && costeDeArma(estado.ajuste.armaId) > saldo;
  const armaId = sinSaldo ? (CATALOGO_ARMAS.find((arma) => costeArma(arma) === 0)?.id ?? estado.ajuste.armaId) : estado.ajuste.armaId;
  const equipoSinSaldo = estado.equipoId !== null && saldo !== null && buscarEquipo(estado.equipoId).coste > saldo;
  fijar({ saldo, ajuste: { ...estado.ajuste, armaId }, ...(equipoSinSaldo ? { equipoId: null } : {}) });
}

export function repetirUltimoDisparo(): void {
  if (!estado.ultimoDisparo || armaEstaAgotada(estado.ultimoDisparo.armaId) || armaFaltaSaldo(estado.ultimoDisparo.armaId) > 0) return;
  fijarAjuste({ ...estado.ultimoDisparo });
}

export function publicarJugable(valor: boolean): void {
  if (estado.puedeDisparar !== valor) fijar({ puedeDisparar: valor });
}

// hud-canales-2: la escena la llama en los mismos puntos donde ya fijaba
// window.__debug.turno -- el canal de estado cambia de nave resaltada en
// cuanto la escena decide que el turno pasó, sin duplicar esa decisión aquí.
export function publicarTurno(turno: IdNave): void {
  if (estado.turno === turno) return;
  // El asiento que acaba de jugar ya vio la ayuda de apuntado (si la había).
  asientosConAyudaApuntadoVista.add(estado.turno);
  const propio = apuntadoPorAsiento.get(turno) ?? APUNTADO_INICIAL;
  fijar({
    turno,
    ajuste: { ...estado.ajuste, anguloGrados: propio.anguloGrados, potencia: propio.potencia },
    ayudaApuntadoVisible: !asientosConAyudaApuntadoVista.has(turno),
  });
}

// El apuntado directo fija ángulo y potencia de un solo gesto: dos llamadas
// seguidas a fijarAnguloGrados/fijarPotencia publicarían un estado
// intermedio con la mitad del gesto.
export function fijarApuntadoDirecto(anguloGrados: number | null, potencia: number): void {
  fijarAjuste({ ...(anguloGrados === null ? {} : { anguloGrados: clampAngulo(anguloGrados) }), potencia: clampPotencia(potencia) });
  if (estado.ayudaApuntadoVisible) cerrarAyudaApuntado();
}

export function cerrarAyudaApuntado(): void {
  asientosConAyudaApuntadoVista.add(estado.turno);
  fijar({ ayudaApuntadoVisible: false });
}

// La escena la llama al terminar de montar la partida; PhaserGame la
// vuelve a marcar como pendiente en cada montaje (también en «otra partida»).
export function publicarPreparando(valor: boolean): void {
  if (estado.preparando !== valor) fijar({ preparando: valor });
}

// hud-canales-1: una sola vez por partida, al crear la escena (la
// personalidad rival no cambia a media partida).
export function publicarNombreRival(nombre: string): void {
  if (estado.nombreRival !== nombre) fijar({ nombreRival: nombre });
}

export function fijarModoEspacial(valor: boolean): void {
  if (estado.modoEspacial !== valor) fijar({ modoEspacial: valor });
}

// Llamado por Partida.ts cuando el disparo del jugador ha terminado de
// resolverse (no al pulsar "Disparar", que solo entrega la intención): así
// "repetir último disparo" siempre precarga un tiro que de verdad ocurrió.
export function publicarDisparoJugadorResuelto(ajuste: EstadoAjuste): void {
  fijar({
    ultimoDisparo: ajuste,
    usosPorArma: { ...estado.usosPorArma, [ajuste.armaId]: (estado.usosPorArma[ajuste.armaId] ?? 0) + 1 },
  });
}

export function cerrarAyuda(): void {
  marcarAyudaVista();
  fijar({ ayudaVisible: false });
}

export function cerrarAyudaDispersion(): void {
  fijar({ ayudaDispersionVisible: false });
}

// realce-impacto (rlc-3): único punto de escritura del ajuste -- persiste de
// inmediato, igual que fijarAjuste con el apuntado, para que sobreviva a
// recargar la página sin depender de ningún otro evento.
export function fijarSacudidaActiva(valor: boolean): void {
  fijar({ sacudidaActiva: valor });
  guardarSacudidaActiva(valor);
}

// sonido-procedimental (snd-1): único punto de alternado del sonido -- delega
// en motor.ts (que persiste y gestiona el AudioContext real) y solo refleja
// el resultado en el store para que el HUD se reactive.
export function alternarSilenciado(): void {
  const valor = alternarSonido();
  fijar({ silenciado: valor });
}

export function alternarMusicaActiva(): void {
  fijar({ musicaActiva: alternarMusica() });
}

type ManejadorDisparo = (entrada: EntradaDeTurno) => void;
let manejadorDisparo: ManejadorDisparo | null = null;

export function registrarManejadorDisparo(manejador: ManejadorDisparo): () => void {
  manejadorDisparo = manejador;
  return () => {
    if (manejadorDisparo === manejador) manejadorDisparo = null;
  };
}

export function solicitarDisparo(): void {
  if (!estado.puedeDisparar || !manejadorDisparo) return;
  if (equipoYaActivo(estado.equipoId)) return;
  if (estado.ayudaDispersionVisible) fijar({ ayudaDispersionVisible: false });
  // nucleo-n-naves: el jugador humano (id 0) sigue siendo solo-contra-la-IA
  // (id 1) hasta multi-setup-partida, que es quien construye la selección
  // de objetivo con varios rivales en pantalla.
  if (estado.equipoId !== null) {
    const equipoId = estado.equipoId;
    fijar({ equipoId: null });
    manejadorDisparo({ accion: equipoId, arma: equipoId, anguloGrados: estado.ajuste.anguloGrados, potencia: estado.ajuste.potencia, objetivoId: 1 });
    return;
  }
  manejadorDisparo({
    arma: estado.ajuste.armaId,
    anguloGrados: estado.ajuste.anguloGrados,
    potencia: estado.ajuste.potencia,
    objetivoId: 1,
  });
}

// partida-completa: "otra partida" reutiliza el mismo store (es un
// singleton de módulo, no ligado al ciclo de vida de React) para una nueva
// escena de Phaser -- sin esto, el ajuste, el arma agotada y el último
// disparo de la partida ya terminada seguirían vivos en la siguiente. La
// ayuda inicial NO se reinicia: ya la vio en este navegador, no hay que
// volver a enseñársela.
export function reiniciarControl(): void {
  ayudaDispersionYaMostrada = false;
  apuntadoPorAsiento.clear();
  asientosConAyudaApuntadoVista.clear();
  fijar({
    ajuste: { anguloGrados: ANGULO_INICIAL_GRADOS, potencia: POTENCIA_INICIAL, armaId: CATALOGO_ARMAS[0].id },
    usosPorArma: {},
    ultimoDisparo: null,
    puedeDisparar: false,
    ayudaDispersionVisible: false,
    modoEspacial: false,
    modo: "barra-libre",
    saldo: null,
      turno: 0,
    nombreRival: "Rival",
    equipoId: null,
    escudoPropioTurnos: 0,
    ayudaApuntadoVisible: true,
    // preparando no se toca: lo gobierna el montaje de la partida, y la
    // escena llama a reiniciarControl dentro de la propia preparación.
  });
}
