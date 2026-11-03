import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { acumuladorInicial, avanzarConAcumulador } from "../../../src/sim/tiempo";

// vel-2: escalar el delta por k solo cambia en qué fotograma se alcanza cada
// paso fijo, nunca la secuencia de estados que recorre la simulación.
function estadosVisitados(deltas: readonly number[], k: number): number[] {
  const visitados: number[] = [];
  let acumulador = acumuladorInicial();
  let estado = 0;
  for (const d of deltas) {
    const r = avanzarConAcumulador(estado, acumulador, d * k, (n) => {
      visitados.push(n + 1);
      return n + 1;
    });
    estado = r.estado;
    acumulador = r.acumulador;
  }
  return visitados;
}

test("vel-2: ×1 y ×3 recorren la misma secuencia de pasos fijos", () => {
  fc.assert(
    fc.property(fc.array(fc.double({ min: 0.5, max: 200, noNaN: true }), { minLength: 1, maxLength: 80 }), fc.constantFrom(1, 3), (deltas, k) => {
      const base = estadosVisitados(deltas, 1);
      const escalado = estadosVisitados(deltas, k);
      const comunes = Math.min(base.length, escalado.length);
      assert.deepEqual(escalado.slice(0, comunes), base.slice(0, comunes));
      // A ×3 se han dado al menos tantos pasos como a ×1 en los mismos fotogramas.
      assert.ok(escalado.length >= base.length);
    }),
  );
});
