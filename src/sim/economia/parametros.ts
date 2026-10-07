// Parámetros del modo «Con presupuesto». Viven aislados porque son lo que se
// recalibra al equilibrar (bloque calibrado-economia) y no deben repartirse
// por el núcleo, la IA y el HUD.

// Presupuesto por ronda, igual para todos los asientos: sin ingreso por daño,
// porque premiar el daño con crédito en una partida de cuatro es una bola de
// nieve para quien ya va ganando.
export const PRESUPUESTO_BASE = 850;

// Redondeo a múltiplos de 5 para que ningún tope salga con decimales raros
// cuando la base se recalibre.
function redondeaA5(valor: number): number {
  return Math.round(valor / 5) * 5;
}

// Lo no gastado se arrastra a la ronda siguiente hasta un cuarto de la base:
// ahorrar es una decisión, pero un tope de la base entera duplicaba el
// presupuesto de quien no gastaba y rompía la calibración de precios.
export const ARRASTRE_MAXIMO = redondeaA5(0.25 * PRESUPUESTO_BASE);

// Lo que da un evento de lotería: la misma cuantía que el arrastre máximo, así
// un golpe de suerte nunca vale más que una partida entera de ahorro.
export const PREMIO_LOTERIA = redondeaA5(0.25 * PRESUPUESTO_BASE);

// Fracción del daño del arma de pago más floja que hace cualquier arma gratis.
export const FRACCION_DANIO_GRATIS = 0.25;
