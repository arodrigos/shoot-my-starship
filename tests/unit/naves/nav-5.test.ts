import { test } from "node:test";
import assert from "node:assert/strict";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";
import { resolverEmpujeEnEspacioAbierto } from "@/sim/naves/empuje";
import type { EstadoNave } from "@/sim/partida/tipos";

const ANCHO = 2000;
const ALTO = 1000;

test("nav-5: un empuje que estrella la nave contra un planeta la deja con integridad 0", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  aplicarHuellaCircular(mascara, 1000, 700, 120, "sumar", 1);

  const nave: EstadoNave = { x: 1000, y: 500, integridad: 100 };
  // Empuje vertical hacia el planeta, más que suficiente para atravesar su
  // superficie desde 200px por encima del borde del disco.
  const resultado = resolverEmpujeEnEspacioAbierto(mascara, ANCHO, ALTO, nave, 0, 250);

  assert.equal(resultado.destruidaPorEmpuje, true);
  assert.equal(resultado.nave.integridad, 0);
});

test("nav-5: un empuje que saca a la nave del mundo la deja con integridad 0 en vez de flotando fuera de mapa", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);

  const nave: EstadoNave = { x: 30, y: 500, integridad: 100 };
  const resultado = resolverEmpujeEnEspacioAbierto(mascara, ANCHO, ALTO, nave, -50, 0);

  assert.equal(resultado.destruidaPorEmpuje, true);
  assert.equal(resultado.nave.integridad, 0);
});

test("nav-5: un empuje que se queda en espacio abierto mueve la nave sin dañarla", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);

  const nave: EstadoNave = { x: 1000, y: 500, integridad: 100 };
  const resultado = resolverEmpujeEnEspacioAbierto(mascara, ANCHO, ALTO, nave, 40, -10);

  assert.equal(resultado.destruidaPorEmpuje, false);
  assert.equal(resultado.nave.integridad, 100);
  assert.equal(resultado.nave.x, 1040);
  assert.equal(resultado.nave.y, 490);
});
