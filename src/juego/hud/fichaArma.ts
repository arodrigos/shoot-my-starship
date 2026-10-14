// Textos de coste de la ficha de arma. «Gratis» sale una sola vez: la nota de
// daño reducido de las armas gratuitas ya no lo repite (#232).
export function etiquetaPrecio(coste: number): string {
  return coste > 0 ? `${coste} cr` : "Gratis";
}

export const NOTA_DANIO_REDUCIDO = " · daño reducido al 25 %";
export const NOTA_EVENTO_GRATIS = " · 25 % de provocar un evento";

// Línea de coste completa en modo presupuesto, tal como la ve el jugador.
export function lineaCosteFicha(coste: number, causaDanio: boolean): string {
  return `${etiquetaPrecio(coste)}${coste === 0 && causaDanio ? NOTA_DANIO_REDUCIDO : ""}${coste === 0 ? NOTA_EVENTO_GRATIS : ""}`;
}
