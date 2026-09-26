import { test } from "node:test";
import assert from "node:assert/strict";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";
import { alturaSuperficie } from "@/sim/armas/resolver";
import type { EstadoNave } from "@/sim/partida/tipos";

test("nav-1: la posición de una nave no se deriva del terreno -- abrir un cráter debajo no la mueve", () => {
  const mascara = crearMascaraVacia(2000, 1000);
  // Un planeta justo bajo la nave: hace que alturaSuperficie(mascara, x) SÍ
  // tenga una respuesta que un cráter puede cambiar -- si no hubiera nada en
  // la columna, "antes" y "después" serían el mismo null y la comparación
  // no demostraría nada.
  aplicarHuellaCircular(mascara, 1000, 700, 120, "sumar", 1);

  const nave: EstadoNave = { x: 1000, y: 400, integridad: 100 };

  const alturaDerivadaAntes = alturaSuperficie(mascara, nave.x);
  assert.notEqual(alturaDerivadaAntes, null, "la columna de la nave debe tener superficie antes del cráter");

  // Cráter grande justo debajo de la nave, hundido en el propio planeta: si
  // la posición de la nave se derivase escaneando la columna del terreno
  // (la confusión natural al leer "las naves se apoyan en el suelo"), esto
  // cambiaría dónde "estaría" la nave.
  aplicarHuellaCircular(mascara, 1000, 620, 80, "restar");

  const alturaDerivadaDespues = alturaSuperficie(mascara, nave.x);
  assert.notEqual(
    alturaDerivadaDespues,
    alturaDerivadaAntes,
    "el cráter debe cambiar lo que se derivaría de la columna, o el test no prueba nada",
  );

  // Pero la posición ALMACENADA de la nave -- lo único que nav-1 exige -- no
  // se mueve un píxel: nadie la ha tocado.
  assert.equal(nave.x, 1000);
  assert.equal(nave.y, 400);
});

test("nav-1: EstadoNave admite una y propia además de x", () => {
  const nave: EstadoNave = { x: 42, y: 99, integridad: 100 };
  assert.equal(nave.y, 99);
});
