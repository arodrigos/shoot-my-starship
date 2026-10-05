import { test } from "node:test";
import assert from "node:assert/strict";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, anguloConPasoFino } from "@/juego/control/apuntado";

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

// adrian-angulo-360: el rango dejó de ser [2, 178] (medio círculo) para
// cubrir el círculo completo -- la aritmética de saturación es la misma,
// solo cambian los límites, así que el test se reescribe contra las
// constantes en vez de contra los números viejos.
test("control-2: el paso fino nunca saca el ángulo de su rango", () => {
  let angulo = ANGULO_MAXIMO_GRADOS - 0.05;
  for (let i = 0; i < 5; i++) {
    angulo = anguloConPasoFino(angulo, 1);
  }
  assert.equal(angulo <= ANGULO_MAXIMO_GRADOS, true, `ángulo ${angulo} superó el máximo`);

  let angulo2 = ANGULO_MINIMO_GRADOS + 0.05;
  for (let i = 0; i < 5; i++) {
    angulo2 = anguloConPasoFino(angulo2, -1);
  }
  assert.equal(angulo2 >= ANGULO_MINIMO_GRADOS, true, `ángulo ${angulo2} superó el mínimo`);
});

// apuntado-y-relevo: el paso fino cruza la costura 0°/360° en los dos sentidos.
test("control-2: el paso fino da la vuelta en la costura de 0°/360°", () => {
  assert.equal(anguloConPasoFino(359.9, 1), 0);
  assert.equal(anguloConPasoFino(0, -1), 359.9);
  assert.equal(anguloConPasoFino(0.2, -1), 0.1);
});
