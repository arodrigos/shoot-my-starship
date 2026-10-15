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
  // «¡Tiempo! Disparo automático»: visible AVISO_TIEMPO_MS tras agotarse.
  readonly aviso: boolean;
}

export const AVISO_TIEMPO_MS = 1500;

const INICIAL: EstadoRelojTurno = { configuradoS: null, estado: "parado", plazoMs: 0, restanteMs: 0, aviso: false };

let estado: EstadoRelojTurno = INICIAL;
let temporizadorAviso: ReturnType<typeof setTimeout> | null = null;
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

export function pausarRelojTurno(): void {
  if (estado.estado !== "corriendo") return;
  tickRelojTurno();
  // El tick pudo agotarlo: entonces ya no hay nada que pausar.
  if (estado.estado === "corriendo") fijar({ estado: "pausado" });
}

export function reanudarRelojTurno(): void {
  if (estado.estado !== "pausado") return;
  fijar({ estado: "corriendo", plazoMs: ahora() + estado.restanteMs });
}

// Al disparar, en el relevo o en un turno de IA: el reloj vuelve a su valor
// entero y desaparece hasta el siguiente turno humano.
export function pararRelojTurno(): void {
  if (estado.estado === "parado") return;
  fijar({ estado: "parado", plazoMs: 0, restanteMs: totalMs() });
}

export function mostrarAvisoTiempo(): void {
  if (temporizadorAviso !== null) clearTimeout(temporizadorAviso);
  fijar({ aviso: true });
  temporizadorAviso = setTimeout(() => {
    temporizadorAviso = null;
    fijar({ aviso: false });
  }, AVISO_TIEMPO_MS);
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
  if (temporizadorAviso !== null) clearTimeout(temporizadorAviso);
  temporizadorAviso = null;
  fijar({ estado: "parado", plazoMs: 0, restanteMs: totalMs(), aviso: false });
}
