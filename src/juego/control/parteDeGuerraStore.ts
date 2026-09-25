import type { EstadisticasPartida, ParteDeGuerra } from "@/sim/partida/parteDeGuerra";

// Puente React/Phaser para la pantalla final (humor-7): mismo patrón
// singleton pub/sub que store.ts y reaccion.ts. Guarda también las
// estadísticas, no solo el texto ya generado, para que la pantalla pueda
// mostrar los números reales junto a la medalla (humor-7 exige que el texto
// no sea un remate fijo disfrazado de dinámico).
export interface EstadoParteDeGuerra {
  readonly parte: (ParteDeGuerra & { estadisticas: EstadisticasPartida }) | null;
}

let estado: EstadoParteDeGuerra = { parte: null };
const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoParteDeGuerra>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

export function obtenerParteDeGuerra(): EstadoParteDeGuerra {
  return estado;
}

export function suscribirParteDeGuerra(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarParteDeGuerra(parte: ParteDeGuerra, estadisticas: EstadisticasPartida): void {
  fijar({ parte: { ...parte, estadisticas } });
}
