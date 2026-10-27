import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { anguloDesdeFraccionControl } from "@/juego/control/apuntado";
import {
  fijarAnguloDesdeFraccion,
  fijarPotenciaDesdeFraccion,
  obtenerEstadoControl,
  reiniciarControl,
} from "@/juego/control/store";

const fraccion = fc.double({ min: 0, max: 1, noNaN: true });

test("ang-inv-1: fijar el ángulo no toca la potencia y fijar la potencia no toca el ángulo", () => {
  fc.assert(
    fc.property(fraccion, fraccion, (a, b) => {
      reiniciarControl();
      const antes = obtenerEstadoControl().ajuste;
      fijarAnguloDesdeFraccion(a);
      assert.equal(obtenerEstadoControl().ajuste.potencia, antes.potencia);
      const angulo = obtenerEstadoControl().ajuste.anguloGrados;
      fijarPotenciaDesdeFraccion(b);
      assert.equal(obtenerEstadoControl().ajuste.anguloGrados, angulo);
    }),
  );
});

test("ang-inv-2: el ángulo final depende solo de la última fracción, no del recorrido", () => {
  fc.assert(
    fc.property(fc.array(fraccion, { minLength: 1, maxLength: 30 }), (recorrido) => {
      reiniciarControl();
      for (const f of recorrido) fijarAnguloDesdeFraccion(f);
      assert.equal(obtenerEstadoControl().ajuste.anguloGrados, anguloDesdeFraccionControl(recorrido[recorrido.length - 1]));
    }),
  );
});
