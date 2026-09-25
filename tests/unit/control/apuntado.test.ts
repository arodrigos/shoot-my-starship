import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANGULO_MAXIMO_GRADOS,
  ANGULO_MINIMO_GRADOS,
  POTENCIA_MAXIMA,
  POTENCIA_MINIMA,
  anguloTrasArrastre,
  potenciaTrasArrastre,
} from "@/juego/control/apuntado";

// Base de control-5 (repetir último disparo): el mismo arrastre relativo,
// aplicado al mismo ajuste de partida, produce siempre el mismo ángulo y la
// misma potencia -- sin esto, "repetir" no podría prometer un impacto
// reproducible.
test("apuntado: el mismo arrastre relativo produce siempre el mismo ángulo y potencia", () => {
  const inicio = { x: 0.5, y: 0.8 };
  const actual = { x: 0.35, y: 0.6 };

  const angulo1 = anguloTrasArrastre(45, inicio, actual);
  const angulo2 = anguloTrasArrastre(45, inicio, actual);
  const potencia1 = potenciaTrasArrastre(50, inicio, actual);
  const potencia2 = potenciaTrasArrastre(50, inicio, actual);

  assert.equal(angulo1, angulo2);
  assert.equal(potencia1, potencia2);
});

test("apuntado: arrastrar hacia arriba de la pantalla sube el ángulo", () => {
  const inicio = { x: 0.5, y: 0.8 };
  const arriba = { x: 0.5, y: 0.5 };
  const angulo = anguloTrasArrastre(45, inicio, arriba);
  assert.equal(angulo > 45, true, `el ángulo debería subir al arrastrar hacia arriba, quedó en ${angulo}`);
});

test("apuntado: arrastrar hacia la derecha sube la potencia", () => {
  const inicio = { x: 0.3, y: 0.8 };
  const derecha = { x: 0.6, y: 0.8 };
  const potencia = potenciaTrasArrastre(50, inicio, derecha);
  assert.equal(potencia > 50, true, `la potencia debería subir al arrastrar a la derecha, quedó en ${potencia}`);
});

test("apuntado: el ángulo y la potencia nunca salen de su rango, por grande que sea el arrastre", () => {
  const inicio = { x: 0.5, y: 0.5 };
  const extremo = { x: 3, y: -3 };

  const angulo = anguloTrasArrastre(90, inicio, extremo);
  const potencia = potenciaTrasArrastre(50, inicio, extremo);

  assert.equal(angulo >= ANGULO_MINIMO_GRADOS && angulo <= ANGULO_MAXIMO_GRADOS, true);
  assert.equal(potencia >= POTENCIA_MINIMA && potencia <= POTENCIA_MAXIMA, true);
});
