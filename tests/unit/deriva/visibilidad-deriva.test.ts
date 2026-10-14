import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { alfaRotuloDeriva, MS_DESVANECIDO_ROTULO, MS_ROTULO_VISIBLE } from "@/juego/deriva/visibilidadDeriva";

const entrada = fc.record({
  modoEspacial: fc.boolean(),
  deriva: fc.oneof(fc.constant(0), fc.double({ min: -100, max: 100, noNaN: true })),
  msVisible: fc.double({ min: 0, max: 20000, noNaN: true }),
  reducirMovimiento: fc.boolean(),
});

test("rd-1: el alfa siempre está en [0, 1]", () => {
  fc.assert(fc.property(entrada, (e) => {
    const alfa = alfaRotuloDeriva(e);
    return alfa >= 0 && alfa <= 1;
  }));
});

test("rd-3: fuera del modo espacial o con deriva distinta de 0 nunca se desvanece", () => {
  fc.assert(fc.property(entrada, (e) => {
    fc.pre(!e.modoEspacial || e.deriva !== 0);
    return alfaRotuloDeriva(e) === 1;
  }));
});

test("rd-1: en espacial con deriva 0 vale 1 antes de 4 s, 0 desde 4,4 s y no crece", () => {
  fc.assert(fc.property(
    fc.double({ min: 0, max: 20000, noNaN: true }),
    fc.double({ min: 0, max: 20000, noNaN: true }),
    fc.boolean(),
    (a, b, reducirMovimiento) => {
      const base = { modoEspacial: true, deriva: 0, reducirMovimiento };
      const [antes, despues] = a <= b ? [a, b] : [b, a];
      const alfaAntes = alfaRotuloDeriva({ ...base, msVisible: antes });
      const alfaDespues = alfaRotuloDeriva({ ...base, msVisible: despues });
      if (antes < MS_ROTULO_VISIBLE) assert.equal(alfaAntes, 1);
      const limite = reducirMovimiento ? MS_ROTULO_VISIBLE : MS_ROTULO_VISIBLE + MS_DESVANECIDO_ROTULO;
      if (despues >= limite) assert.equal(alfaDespues, 0);
      return alfaDespues <= alfaAntes;
    },
  ));
});

test("rd-2: con movimiento reducido solo toma los valores 0 y 1", () => {
  fc.assert(fc.property(entrada, (e) => {
    const alfa = alfaRotuloDeriva({ ...e, reducirMovimiento: true });
    return alfa === 0 || alfa === 1;
  }));
});

test("rd-1: a mitad del desvanecido el alfa es intermedio", () => {
  const alfa = alfaRotuloDeriva({ modoEspacial: true, deriva: 0, msVisible: 4200, reducirMovimiento: false });
  assert.ok(alfa > 0 && alfa < 1);
});
