import type { Arma } from "@/sim/armas/tipos";

// modos-y-presupuesto: los números de arranque del modo con presupuesto,
// aislados en su propio fichero de datos porque el diseño los marca como "el
// número más probable de tener que moverse" -- la decisión F hizo acertar más
// difícil, así que el ritmo de ingreso por daño es la palanca de ajuste, no
// una constante enterrada en avanzar().
export const SALDO_INICIAL = 1000;

// 1 crédito por punto de daño causado: "acertar paga" de forma literal, sin
// redondeos que compliquen la aritmética exacta que exige modo-1 (el saldo
// tras dos disparos tiene que caer en el valor exacto, no en uno aproximado).
export const TASA_INGRESO_POR_DANIO = 1;

export function costeArma(arma: Arma): number {
  return arma.coste ?? 0;
}

export function ingresoPorDanio(danio: number): number {
  return danio * TASA_INGRESO_POR_DANIO;
}

export function puedeCostearArma(arma: Arma, saldo: number): boolean {
  return costeArma(arma) <= saldo;
}
