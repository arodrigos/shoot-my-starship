import { test } from "node:test";
import assert from "node:assert/strict";
import { LA_CONTABLE } from "@/sim/ia/personalidades";
import { medirPersonalidad } from "../../utils/medirIA";

// ia-autodanio-5: dos ejecuciones de medir:ia con las mismas semillas dan
// exactamente el mismo informe -- el jugador patrón (fuenteAleatoria,
// docs/jugador-patron.md) y el propio lote de medición no pueden depender de
// nada no sembrado (Math.random, Date.now, orden de iteración de un Map...).
// Semilla y número de partidas distintos de los que usa medir:ia a
// propósito: lo que se comprueba es la reproducibilidad del harness en sí,
// no un valor concreto, así que no hace falta pagar 200 partidas dos veces.
test("ia-autodanio-5: medirPersonalidad es determinista -- misma semilla, mismo informe", () => {
  const primero = medirPersonalidad(LA_CONTABLE, 777, 20);
  const segundo = medirPersonalidad(LA_CONTABLE, 777, 20);
  assert.deepEqual(segundo, primero);
});
