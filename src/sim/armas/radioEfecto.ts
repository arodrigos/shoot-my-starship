import type { Arma } from "@/sim/armas/tipos";

// Radio de efecto real de un arma en un mundo concreto. Casi todo el
// catálogo lo declara en unidades fijas; la onda del gancho se mide contra
// la diagonal para que "un octavo de la pantalla" lo sea en cualquier
// viewport, y por eso necesita el tamaño del mundo.
export function radioEfectoEnMundo(arma: Arma, ancho: number, alto: number): number {
  if (arma.ondaFraccionDiagonal !== undefined) {
    return Math.hypot(ancho, alto) * arma.ondaFraccionDiagonal;
  }
  if (arma.efecto.tipo === "empuje") {
    return arma.huella.tipo === "ninguna" ? 0 : arma.huella.radio;
  }
  return arma.efecto.radioEfectoPx;
}
