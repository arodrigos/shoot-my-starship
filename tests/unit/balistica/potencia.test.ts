import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import {
  POTENCIA_MAXIMA_PX_S,
  POTENCIA_MINIMA_PX_S,
  potenciaDesdeVelocidad,
  velocidadDesdePotencia,
} from "@/sim/balistica/potencia";
import { colocarNaves } from "@/sim/naves/colocacion";
import { muestra } from "../../utils/muestra";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../../utils/sistemaGenerado";

test("fza-1: a fuerza 100 la velocidad es 1050 px/s (un 25 % menos que los 1400 de antes), a 0 son 300 y a 50 son 675", () => {
  assert.equal(POTENCIA_MAXIMA_PX_S, 1050);
  assert.equal(velocidadDesdePotencia(100), 1050);
  assert.equal(velocidadDesdePotencia(0), 300);
  assert.equal(velocidadDesdePotencia(50), 675);
  assert.equal(POTENCIA_MAXIMA_PX_S, 1400 * 0.75);
});

test("fza-1 (invariante): velocidadDesdePotencia queda en [300, 1050], es monótona creciente e invertible", () => {
  fc.assert(
    fc.property(fc.double({ min: -50, max: 150, noNaN: true }), fc.double({ min: -50, max: 150, noNaN: true }), (a, b) => {
      const va = velocidadDesdePotencia(a);
      const vb = velocidadDesdePotencia(b);
      assert.ok(va >= POTENCIA_MINIMA_PX_S && va <= POTENCIA_MAXIMA_PX_S);
      if (a <= b) assert.ok(va <= vb);
    }),
  );
  fc.assert(
    fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (p) => {
      assert.ok(Math.abs(potenciaDesdeVelocidad(velocidadDesdePotencia(p)) - p) <= 1e-9);
    }),
  );
});

// fza-2: la colocación aleatoria exige un tiro viable (simulado con el
// vuelo real y la potencia máxima nueva) en los dos sentidos. Se mide que
// casi nunca tenga que caer a la red de seguridad sin viabilidad.
for (const cantidad of [2, 4]) {
  test(`fza-2: con la fuerza reducida, ≥ 97 % de las colocaciones de ${cantidad} naves tienen tiro viable demostrado`, () => {
    const mundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
    const total = muestra(200);
    let viables = 0;
    for (let semilla = 1; semilla <= total; semilla++) {
      const r = colocarNaves(semilla, mundo, crearEstadoAleatorio(semilla), cantidad);
      if (r.escalon === "recolocacion" || r.escalon === "regeneracion") viables++;
    }
    assert.ok(viables / total >= 0.97, `${viables}/${total} colocaciones con tiro viable`);
  });
}
