import { test } from "node:test";
import assert from "node:assert/strict";
import { hashDeLote, jugarLote } from "../../utils/loteAleatorio";

test("nucleo-4: 500 partidas con la misma semilla maestra dan resultados idénticos en dos ejecuciones", () => {
  const primeraEjecucion = jugarLote(20260925, 500);
  const segundaEjecucion = jugarLote(20260925, 500);

  assert.equal(primeraEjecucion.length, 500);
  // Con Math.random esto no reproduciría dos veces el mismo hash: el grep de
  // comprobar-sin-math-random.mjs atrapa la llamada olvidada, esto atrapa
  // cualquier otra fuga de no-determinismo (Date.now, orden de iteración...).
  assert.equal(hashDeLote(primeraEjecucion), hashDeLote(segundaEjecucion));
});
