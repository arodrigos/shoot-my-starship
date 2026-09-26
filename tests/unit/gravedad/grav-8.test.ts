import { test } from "node:test";
import assert from "node:assert/strict";
import { AIRE, ESCOMBRO, crearMascaraVacia, esMaterialPlaneta, esSolido, obtenerMaterial } from "@/sim/terreno/mascara";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";

test("grav-8: esSolido distingue aire de planeta y de escombro, y sigue siendo falso fuera de límites en las cuatro direcciones", () => {
  const mascara = crearMascaraVacia(100, 100);
  aplicarHuellaCircular(mascara, 30, 30, 10, "sumar", 1);
  aplicarHuellaCircular(mascara, 70, 30, 10, "sumar", 255); // escombro, vía material directo

  assert.equal(esSolido(mascara, 30, 30), true, "un píxel de planeta debe ser sólido");
  assert.equal(esSolido(mascara, 70, 30), true, "un píxel de escombro debe ser sólido");
  assert.equal(esSolido(mascara, 0, 0), false, "un píxel de aire debe seguir siendo no sólido");

  assert.equal(esSolido(mascara, -1, 50), false, "fuera de límites por la izquierda");
  assert.equal(esSolido(mascara, 100, 50), false, "fuera de límites por la derecha");
  assert.equal(esSolido(mascara, 50, -1), false, "fuera de límites por arriba");
  assert.equal(esSolido(mascara, 50, 100), false, "fuera de límites por abajo");
});

test("grav-8: el material distingue a qué planeta pertenece cada píxel sólido", () => {
  const mascara = crearMascaraVacia(100, 100);
  aplicarHuellaCircular(mascara, 20, 20, 8, "sumar", 1);
  aplicarHuellaCircular(mascara, 80, 20, 8, "sumar", 2);
  aplicarHuellaCircular(mascara, 20, 80, 8, "sumar", 255);

  assert.equal(obtenerMaterial(mascara, 20, 20), 1);
  assert.equal(obtenerMaterial(mascara, 80, 20), 2);
  assert.equal(obtenerMaterial(mascara, 20, 80), ESCOMBRO);
  assert.equal(obtenerMaterial(mascara, 50, 50), AIRE);
  assert.equal(obtenerMaterial(mascara, -1, 50), AIRE, "fuera de límites es aire, igual que esSolido");

  assert.equal(esMaterialPlaneta(obtenerMaterial(mascara, 20, 20)), true);
  assert.equal(esMaterialPlaneta(obtenerMaterial(mascara, 80, 20)), true);
  assert.notEqual(obtenerMaterial(mascara, 20, 20), obtenerMaterial(mascara, 80, 20));
  assert.equal(esMaterialPlaneta(ESCOMBRO), false, "el escombro es sólido pero no es un planeta");
});
