import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularRectanguloDiferente } from "@/sim/terreno/diferencia";
import { crearMascaraVacia, SOLIDO } from "@/sim/terreno/mascara";

test("calcularRectanguloDiferente: dos máscaras iguales no producen rectángulo", () => {
  const a = crearMascaraVacia(50, 50);
  const b = crearMascaraVacia(50, 50);
  assert.equal(calcularRectanguloDiferente(a, b), null);
});

test("calcularRectanguloDiferente: acota exactamente los píxeles que cambiaron", () => {
  const a = crearMascaraVacia(50, 50);
  const b = crearMascaraVacia(50, 50);
  b.datos[10 * 50 + 20] = SOLIDO;
  b.datos[12 * 50 + 25] = SOLIDO;

  const rectangulo = calcularRectanguloDiferente(a, b);

  assert.deepEqual(rectangulo, { x: 20, y: 10, ancho: 6, alto: 3 });
});

test("calcularRectanguloDiferente: detecta también cuando la huella nueva RELLENA (sumar)", () => {
  const a = crearMascaraVacia(30, 30);
  a.datos[5 * 30 + 5] = SOLIDO;
  const b = crearMascaraVacia(30, 30); // relleno vuelto a aire

  const rectangulo = calcularRectanguloDiferente(a, b);

  assert.deepEqual(rectangulo, { x: 5, y: 5, ancho: 1, alto: 1 });
});

test("calcularRectanguloDiferente: máscaras de distinto tamaño son un error de uso, no un rectángulo vacío", () => {
  const a = crearMascaraVacia(10, 10);
  const b = crearMascaraVacia(20, 20);
  assert.throws(() => calcularRectanguloDiferente(a, b));
});
