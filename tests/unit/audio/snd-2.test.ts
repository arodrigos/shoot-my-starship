import { test } from "node:test";
import assert from "node:assert/strict";
import { indiceTic } from "@/juego/audio/cadenciaTicTac";

// snd-2: la cadencia se demuestra en el valor devuelto por una función pura,
// nunca en tiempo real transcurrido (issue #151 prohíbe sleeps en el camino
// crítico) -- se recorre una secuencia DESCENDENTE de segundosRestantes (el
// mismo sentido en que avanza una cuenta atrás real) y se cuenta cuántas
// veces cambia el índice en cada tramo de un segundo: el tramo final debe
// producir más cambios que el tramo lejano, es decir, tics más seguidos.
function contarTics(desdeS: number, hastaS: number, pasoS: number): number {
  let tics = 0;
  let anterior = indiceTic(desdeS);
  for (let s = desdeS - pasoS; s >= hastaS; s -= pasoS) {
    const indice = indiceTic(s);
    if (indice !== anterior) tics += 1;
    anterior = indice;
  }
  return tics;
}

test("snd-2: el tic-tac se acelera según segundosRestantes se acerca a cero", () => {
  const PASO_MUESTREO_S = 0.01;
  const ticsLejos = contarTics(5, 4, PASO_MUESTREO_S);
  const ticsCerca = contarTics(1, 0, PASO_MUESTREO_S);

  assert.ok(
    ticsCerca > ticsLejos,
    `se esperaban más tics en el último segundo (${ticsCerca}) que en uno lejano (${ticsLejos})`,
  );
});

test("snd-2: indiceTic es monótono no creciente a medida que baja segundosRestantes", () => {
  let anterior = indiceTic(10);
  for (let s = 10; s >= 0; s -= 0.05) {
    const indice = indiceTic(s);
    assert.ok(indice <= anterior, `indiceTic(${s})=${indice} no debería superar el índice anterior ${anterior}`);
    anterior = indice;
  }
});

test("snd-2: segundosRestantes negativo o cero se trata como el final de la cuenta atrás", () => {
  assert.equal(indiceTic(0), indiceTic(-5), "un valor negativo satura igual que 0, nunca produce un índice mayor");
});
