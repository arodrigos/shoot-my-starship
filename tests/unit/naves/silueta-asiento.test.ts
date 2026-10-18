import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { contornoSiluetaAsiento } from "../../../src/juego/naves/siluetaAsiento";
import { hashPuntos } from "../../../src/juego/naves/formaCasco";

const asiento = fc.integer({ min: 0, max: 3 });

test("ma-1: dos asientos distintos tienen contornos distintos (hash distinto)", () => {
  fc.assert(
    fc.property(asiento, asiento, (a, b) => {
      fc.pre(a !== b);
      assert.notEqual(hashPuntos(contornoSiluetaAsiento(a)), hashPuntos(contornoSiluetaAsiento(b)));
    }),
  );
});

test("ma-1: el contorno cabe en la caja unidad y tiene entre 10 y 16 vértices", () => {
  fc.assert(
    fc.property(asiento, (a) => {
      const puntos = contornoSiluetaAsiento(a);
      assert.ok(puntos.length >= 10 && puntos.length <= 16, `vértices: ${puntos.length}`);
      for (const p of puntos) {
        assert.ok(p.x >= -1e-9 && p.x <= 1 + 1e-9 && p.y >= -1e-9 && p.y <= 1 + 1e-9, `fuera de la caja: ${p.x},${p.y}`);
      }
    }),
  );
});
