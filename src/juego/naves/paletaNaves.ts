// Paleta compartida entre Nave.ts (lo que se ve en partida), la cáscara React
// y verificar-siluetas.ts. Vivir en un sitio único evita que el arnés de
// verificación compare contra colores que no son los que de verdad se pintan.
// Los cuatro asientos están en uso. Los valores se miden en
// tests/unit/naves/paleta-daltonismo.test.ts (ΔE2000 ≥ 12 entre asientos con
// protanopía, deuteranopía y tritanopía): el azul y el lila originales eran
// casi idénticos para un tritanope (ΔE 1,4), así que el azul se hizo más
// saturado y el lila más oscuro, sin perder su tono.
export const COLORES_NAVE: readonly [number, number, number, number] = [
  0x3bafdf, // asiento 0 (azul)
  0xff6b4a, // asiento 1 (rojo)
  0x8aec8c, // asiento 2 (verde)
  0x9749b6, // asiento 3 (lila)
];

// Color de asiento en CSS: la cáscara React lo usa para pintar nombres y el
// e2e lo compara contra __debug.naves, así que sale de la misma paleta.
export function colorCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function colorDeAsiento(id: number): string {
  return colorCss(COLORES_NAVE[id] ?? COLORES_NAVE[0]);
}
