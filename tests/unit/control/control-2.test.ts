import { test } from "node:test";
import assert from "node:assert/strict";
import { anguloConPasoFino } from "@/juego/control/apuntado";

// control-2: 10 pulsaciones de +0.1° cambian el ángulo exactamente 1.0°. El
// tamaño físico del botón (>=24x24 px CSS) es una comprobación de layout, se
// verifica en el e2e (control-2.e2e.ts); aquí solo la aritmética.
test("control-2: 10 pulsaciones de +0.1° cambian el ángulo exactamente 1.0°", () => {
  let angulo = 45;
  const inicial = angulo;
  for (let i = 0; i < 10; i++) {
    angulo = anguloConPasoFino(angulo, 1);
  }
  assert.equal(Math.abs(angulo - (inicial + 1.0)) < 1e-9, true, `ángulo final ${angulo}, se esperaba ${inicial + 1.0}`);
});

test("control-2: 10 pulsaciones de -0.1° cambian el ángulo exactamente -1.0°", () => {
  let angulo = 90;
  const inicial = angulo;
  for (let i = 0; i < 10; i++) {
    angulo = anguloConPasoFino(angulo, -1);
  }
  assert.equal(Math.abs(angulo - (inicial - 1.0)) < 1e-9, true, `ángulo final ${angulo}, se esperaba ${inicial - 1.0}`);
});

test("control-2: el paso fino nunca saca el ángulo de [2, 178]", () => {
  let angulo = 177.95;
  for (let i = 0; i < 5; i++) {
    angulo = anguloConPasoFino(angulo, 1);
  }
  assert.equal(angulo <= 178, true, `ángulo ${angulo} superó el máximo`);

  let angulo2 = 2.05;
  for (let i = 0; i < 5; i++) {
    angulo2 = anguloConPasoFino(angulo2, -1);
  }
  assert.equal(angulo2 >= 2, true, `ángulo ${angulo2} superó el mínimo`);
});
