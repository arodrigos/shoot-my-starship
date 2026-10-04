import { test } from "node:test";
import assert from "node:assert/strict";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, anguloDesdeFraccionControl, clampAngulo } from "@/juego/control/apuntado";

// adrian-angulo-360: el rango deja de ser un medio círculo (2°-178°, siempre
// hacia arriba) para cubrir el círculo completo con un solo control, sin
// modos ni botones aparte para "hacia abajo".
test("adrian-angulo-360: el rango de ángulo cubre el círculo completo", () => {
  assert.equal(ANGULO_MINIMO_GRADOS, 0);
  assert.equal(ANGULO_MAXIMO_GRADOS, 360);
});

test("adrian-angulo-360: el único control alcanza ángulos por debajo del horizonte (>180°)", () => {
  const angulo = anguloDesdeFraccionControl(0.75);
  assert.equal(angulo > 180 && angulo <= 360, true, `se esperaba un ángulo por debajo del horizonte, quedó en ${angulo}`);
});

test("adrian-angulo-360: clampAngulo ya no recorta nada entre 0 y 360", () => {
  assert.equal(clampAngulo(270), 270);
  assert.equal(clampAngulo(0), 0);
  assert.equal(clampAngulo(360), 360);
});
