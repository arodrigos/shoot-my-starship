// sonido-procedimental (snd-2): "el tic-tac se acelera según se acerca a
// cero" debe demostrarse sin depender del reloj real (issue #151 prohíbe
// aserciones de camino crítico basadas en sleep/tiempo real) -- aquí se
// cuenta con que segundosRestantes YA es determinista, viene de la propia
// simulación (pasosDeMecha/pasosDeAdherencia en src/sim), no de Date.now().
// Esta función pura cuantiza ese valor en intervalos cada vez más cortos a
// medida que baja; el llamador (Partida.ts) detecta "ha sonado un nuevo tic"
// comparando el índice devuelto entre dos frames consecutivos. Al ser pura y
// sin reloj, un test unitario puede recorrer una secuencia de
// segundosRestantes descendente y comprobar la propiedad de aceleración sin
// un solo setTimeout.
const UMBRAL_TRAMO_MEDIO_S = 2;
const UMBRAL_TRAMO_FINAL_S = 0.5;
const PASO_TRAMO_LARGO_S = 0.5;
const PASO_TRAMO_MEDIO_S = 0.25;
const PASO_TRAMO_FINAL_S = 0.1;

// Construida contando límites de tramo desde 0 hacia arriba (nunca al revés)
// para que el índice sea continuo en los dos puntos de corte: el tramo de
// abajo fija cuántos tics "ya ha gastado" el de encima antes de empezar a
// contar los suyos propios, igual que un cuentakilómetros que seguiría
// subiendo aunque cambiase el tamaño de sus marcas.
const BASE_TRAMO_MEDIO = Math.floor(UMBRAL_TRAMO_FINAL_S / PASO_TRAMO_FINAL_S);
const BASE_TRAMO_LARGO = BASE_TRAMO_MEDIO + Math.floor((UMBRAL_TRAMO_MEDIO_S - UMBRAL_TRAMO_FINAL_S) / PASO_TRAMO_MEDIO_S);

export function indiceTic(segundosRestantes: number): number {
  const s = Math.max(0, segundosRestantes);
  if (s <= UMBRAL_TRAMO_FINAL_S) {
    return Math.floor(s / PASO_TRAMO_FINAL_S);
  }
  if (s <= UMBRAL_TRAMO_MEDIO_S) {
    return BASE_TRAMO_MEDIO + Math.floor((s - UMBRAL_TRAMO_FINAL_S) / PASO_TRAMO_MEDIO_S);
  }
  return BASE_TRAMO_LARGO + Math.floor((s - UMBRAL_TRAMO_MEDIO_S) / PASO_TRAMO_LARGO_S);
}
