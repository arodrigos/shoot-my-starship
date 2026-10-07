// Parámetros del modo «Con presupuesto». Viven aislados porque son lo que se
// recalibra al equilibrar (bloque calibrado-economia) y no deben repartirse
// por el núcleo, la IA y el HUD.

// Presupuesto por partida, igual para todos los asientos y fijo: lo que sobra
// no pasa a la partida siguiente. Sin ingreso por daño, porque premiar el daño
// con crédito en una partida de cuatro es una bola de nieve para quien ya va
// ganando.
export const PRESUPUESTO_BASE = 600;

// Lo que da un evento de lotería: un cuarto de la base, para que un golpe de
// suerte nunca valga más que una fracción del presupuesto.
export const PREMIO_LOTERIA = 150;

// Fracción del daño del arma de pago más floja que hace cualquier arma gratis.
export const FRACCION_DANIO_GRATIS = 0.25;
