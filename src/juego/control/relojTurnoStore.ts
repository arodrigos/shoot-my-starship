// reloj-turno: puente React/Phaser del reloj opcional del turno humano. Mismo
// patrón singleton pub/sub que cuentaAtrasStore.ts. Trabaja con un plazo
// absoluto sobre un reloj inyectable (performance.now por defecto): los
// temporizadores de una pestaña en segundo plano se agrupan, así que contar
// ticks se desfasaría; el tick solo sirve para repintar.
export type SegundosReloj = 30 | 45 | 60;
export const OPCIONES_RELOJ: readonly SegundosReloj[] = [30, 45, 60];

export type EstadoReloj = "parado" | "corriendo" | "pausado" | "agotado";

export interface EstadoRelojTurno {
  readonly configuradoS: SegundosReloj | null;
  readonly estado: EstadoReloj;
  readonly plazoMs: number;
  readonly restanteMs: number;
  // «¡Tiempo! Disparo automático»: visible hasta que aterriza el tiro
  // automático, entre AVISO_TIEMPO_MINIMO_MS y AVISO_TIEMPO_TOPE_MS.
  readonly aviso: boolean;
}

// Mínimo para poder leerlo desde el sofá aunque el tiro aterrice enseguida; el
// tope evita que se quede para siempre si el vuelo se pierde en órbita.
export const AVISO_TIEMPO_MINIMO_MS = 3000;
export const AVISO_TIEMPO_TOPE_MS = 10000;

// ⚙ abierto y pestaña oculta son pausas independientes: el reloj solo corre
// cuando no queda ninguna, así que cerrar ⚙ con la pestaña oculta no lo reanuda.
export type MotivoPausaReloj = "pestana-oculta" | "ajustes";

const INICIAL: EstadoRelojTurno = { configuradoS: null, estado: "parado", plazoMs: 0, restanteMs: 0, aviso: false };

let estado: EstadoRelojTurno = INICIAL;
const motivosPausa = new Set<MotivoPausaReloj>();
let temporizadorMinimoAviso: ReturnType<typeof setTimeout> | null = null;
let temporizadorTopeAviso: ReturnType<typeof setTimeout> | null = null;
let avisoMinimoCumplido = false;
let avisoAterrizado = false;
let ahora: () => number = () => performance.now();
let alAgotarse: (() => void) | null = null;
const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoRelojTurno>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

function totalMs(): number {
  return (estado.configuradoS ?? 0) * 1000;
}

export function obtenerRelojTurno(): EstadoRelojTurno {
  return estado;
}

export function suscribirRelojTurno(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

// Solo para pruebas: sustituye el reloj por uno controlado.
export function inyectarRelojDeTiempo(fuente: (() => number) | null): void {
  ahora = fuente ?? (() => performance.now());
}

// La escena decide qué es "disparar solo"; el store solo avisa, una vez por
// turno, del paso a 'agotado'.
export function registrarAlAgotarseReloj(manejador: () => void): () => void {
  alAgotarse = manejador;
  return () => {
    if (alAgotarse === manejador) alAgotarse = null;
  };
}

// Se elige en la portada; con null (Off) ninguna secuencia llega a 'agotado'.
export function configurarRelojTurno(segundos: SegundosReloj | null): void {
  fijar({ configuradoS: segundos, estado: "parado", plazoMs: 0, restanteMs: (segundos ?? 0) * 1000 });
}

export function arrancarRelojTurno(): void {
  if (estado.configuradoS === null) return;
  // Con ⚙ abierto (o la pestaña oculta) al empezar el turno, nace pausado.
  if (motivosPausa.size > 0) {
    fijar({ estado: "pausado", plazoMs: 0, restanteMs: totalMs() });
    return;
  }
  fijar({ estado: "corriendo", plazoMs: ahora() + totalMs(), restanteMs: totalMs() });
}

// Refresca restanteMs contra el reloj. El paso a 'agotado' ocurre solo desde
// 'corriendo', así que un tick posterior no vuelve a dispararlo.
export function tickRelojTurno(): void {
  if (estado.estado !== "corriendo") return;
  const restante = Math.min(totalMs(), Math.max(0, estado.plazoMs - ahora()));
  if (restante > 0) {
    if (restante !== estado.restanteMs) fijar({ restanteMs: restante });
    return;
  }
  fijar({ restanteMs: 0, estado: "agotado" });
  alAgotarse?.();
}

// Los motivos se anotan aunque el reloj no corra (turno de la IA): así un ⚙
// abierto al empezar el turno humano lo deja pausado desde el primer instante.
export function pausarRelojTurno(motivo: MotivoPausaReloj): void {
  motivosPausa.add(motivo);
  if (estado.estado !== "corriendo") return;
  tickRelojTurno();
  // El tick pudo agotarlo: entonces ya no hay nada que pausar.
  if (estado.estado === "corriendo") fijar({ estado: "pausado" });
}

export function reanudarRelojTurno(motivo: MotivoPausaReloj): void {
  motivosPausa.delete(motivo);
  if (estado.estado !== "pausado" || motivosPausa.size > 0) return;
  fijar({ estado: "corriendo", plazoMs: ahora() + estado.restanteMs });
}

// Al disparar, en el relevo o en un turno de IA: el reloj vuelve a su valor
// entero y desaparece hasta el siguiente turno humano.
export function pararRelojTurno(): void {
  if (estado.estado === "parado") return;
  fijar({ estado: "parado", plazoMs: 0, restanteMs: totalMs() });
}

function limpiarTemporizadoresAviso(): void {
  if (temporizadorMinimoAviso !== null) clearTimeout(temporizadorMinimoAviso);
  if (temporizadorTopeAviso !== null) clearTimeout(temporizadorTopeAviso);
  temporizadorMinimoAviso = null;
  temporizadorTopeAviso = null;
}

function ocultarAviso(): void {
  limpiarTemporizadoresAviso();
  if (estado.aviso) fijar({ aviso: false });
}

export function mostrarAvisoTiempo(): void {
  limpiarTemporizadoresAviso();
  avisoMinimoCumplido = false;
  avisoAterrizado = false;
  fijar({ aviso: true });
  temporizadorMinimoAviso = setTimeout(() => {
    temporizadorMinimoAviso = null;
    avisoMinimoCumplido = true;
    if (avisoAterrizado) ocultarAviso();
  }, AVISO_TIEMPO_MINIMO_MS);
  temporizadorTopeAviso = setTimeout(ocultarAviso, AVISO_TIEMPO_TOPE_MS);
}

// La escena lo llama cuando termina el vuelo del tiro automático. Sin aviso
// visible no hace nada: un aterrizaje normal no debe marcar el siguiente aviso.
export function cerrarAvisoTiempoAlAterrizar(): void {
  if (!estado.aviso) return;
  avisoAterrizado = true;
  if (avisoMinimoCumplido) ocultarAviso();
}

// Solo para e2e: descuenta tiempo por la misma ruta que el paso del tiempo.
export function adelantarRelojTurno(ms: number): void {
  if (estado.estado !== "corriendo") return;
  fijar({ plazoMs: estado.plazoMs - ms });
  tickRelojTurno();
}

// Singleton de módulo: una partida nueva no hereda un reloj a medias, pero
// conserva lo elegido en la portada.
export function reiniciarRelojTurno(): void {
  alAgotarse = null;
  limpiarTemporizadoresAviso();
  fijar({ estado: "parado", plazoMs: 0, restanteMs: totalMs(), aviso: false });
}
