// Puente React/Phaser para el panel "resultado del turno" (esp-6): mismo
// patrón singleton pub/sub que store.ts y parteDeGuerraStore.ts. Vive
// aparte de EstadoControl porque no tiene nada que ver con el ajuste de
// disparo -- es un resumen de lo que YA pasó, no de lo que se está por
// disparar.
export interface EstadoResultadoTurno {
  readonly texto: string;
}

// Texto por defecto, nunca vacío (esp-6 exige un texto accesible desde el
// primer fotograma, no solo tras el primer disparo).
const TEXTO_INICIAL = "A tus mandos. Apunta y dispara cuando quieras.";

let estado: EstadoResultadoTurno = { texto: TEXTO_INICIAL };
const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoResultadoTurno>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

export function obtenerResultadoTurno(): EstadoResultadoTurno {
  return estado;
}

export function suscribirResultadoTurno(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarResultadoTurno(texto: string): void {
  fijar({ texto });
}

// partida-completa: mismo motivo que limpiarParteDeGuerra -- singleton de
// módulo, hay que devolverlo al texto inicial al arrancar una escena nueva.
export function reiniciarResultadoTurno(): void {
  fijar({ texto: TEXTO_INICIAL });
}
