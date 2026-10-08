// arte-siluetas-3/4: paleta compartida entre Nave.ts (lo que se ve en
// partida, hoy solo índices 0 y 1) y verificar-siluetas.ts (que renderiza
// las cuatro variantes sin que exista aún el modo de 4 jugadores). Vivir en
// un sitio único evita que el arnés de verificación compare contra colores
// inventados que no son los que de verdad se pintan.
export const COLORES_NAVE: readonly [number, number, number, number] = [
  0x5ac8fa, // nave 0 (hoy: jugador humano)
  0xff6b4a, // nave 1 (hoy: rival)
  0x7ee081, // nave 2 (reservada para nucleo-n-naves)
  0xd98cff, // nave 3 (reservada para nucleo-n-naves)
];

// Color de asiento en CSS: la cáscara React lo usa para pintar nombres y el
// e2e lo compara contra __debug.naves, así que sale de la misma paleta.
export function colorCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function colorDeAsiento(id: number): string {
  return colorCss(COLORES_NAVE[id] ?? COLORES_NAVE[0]);
}
