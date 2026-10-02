import { test } from "node:test";
import assert from "node:assert/strict";
import { hashDeLote, jugarLote } from "../../utils/loteAleatorio";
import { muestra } from "../../utils/muestra";

const NUM_PARTIDAS = muestra(500);

test(`nucleo-4: ${NUM_PARTIDAS} partidas con la misma semilla maestra dan resultados idénticos en dos ejecuciones`, () => {
  const primeraEjecucion = jugarLote(20260925, NUM_PARTIDAS);
  const segundaEjecucion = jugarLote(20260925, NUM_PARTIDAS);

  assert.equal(primeraEjecucion.length, NUM_PARTIDAS);
  // Con Math.random esto no reproduciría dos veces el mismo hash: el grep de
  // comprobar-sin-math-random.mjs atrapa la llamada olvidada, esto atrapa
  // cualquier otra fuga de no-determinismo (Date.now, orden de iteración...).
  assert.equal(hashDeLote(primeraEjecucion), hashDeLote(segundaEjecucion));
});
