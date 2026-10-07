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

// partida-completa: limpia la medalla de la partida anterior al arrancar
// una nueva escena -- este store es un singleton de módulo, así que sin
// esto "otra partida" mostraría el parte de guerra ya obsoleto durante el
// primer fotograma, antes de que la partida nueva pueda haber terminado.
export function limpiarParteDeGuerra(): void {
  fijar({ parte: null });
}

// Señal de "otra partida" (partida-1): el botón vive en React
// (ParteDeGuerraHUD), pero quien sabe cómo arrancar una escena nueva con un
// mundo distinto es el componente que monta JuegoLienzo -- mismo patrón de
// desacoplo que registrarManejadorDisparo en store.ts.
const escuchasOtraPartida = new Set<() => void>();

export function solicitarOtraPartida(): void {
  for (const escucha of escuchasOtraPartida) escucha();
}

export function suscribirOtraPartida(escucha: () => void): () => void {
  escuchasOtraPartida.add(escucha);
  return () => escuchasOtraPartida.delete(escucha);
}
