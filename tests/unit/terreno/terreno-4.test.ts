import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverCaida } from "@/sim/terreno/caida";
import { crearMascaraVacia, SOLIDO, type Mascara } from "@/sim/terreno/mascara";

function llenarColumna(mascara: Mascara, x: number, desdeY: number): void {
  for (let y = desdeY; y < mascara.alto; y++) {
    mascara.datos[y * mascara.ancho + x] = SOLIDO;
  }
}

test("terreno-4: suelo plano -- se apoya justo encima de la superficie", () => {
  const mascara = crearMascaraVacia(20, 20);
  llenarColumna(mascara, 5, 15); // sólido desde y=15 hasta el fondo

  const resultado = resolverCaida(mascara, 5);

  assert.deepEqual(resultado, { tipo: "reposo", y: 14 });
});

test("terreno-4: pendiente -- cada columna se apoya en su propia altura de superficie", () => {
  const mascara = crearMascaraVacia(20, 20);
  llenarColumna(mascara, 3, 10);
  llenarColumna(mascara, 4, 12);
  llenarColumna(mascara, 5, 14);

  assert.deepEqual(resolverCaida(mascara, 3), { tipo: "reposo", y: 9 });
  assert.deepEqual(resolverCaida(mascara, 4), { tipo: "reposo", y: 11 });
  assert.deepEqual(resolverCaida(mascara, 5), { tipo: "reposo", y: 13 });
});

test("terreno-4: columna estrecha volada por una explosión -- cae hasta el siguiente sólido", () => {
  const mascara = crearMascaraVacia(20, 20);
  llenarColumna(mascara, 8, 5);
  // La explosión vació la columna 8 entre y=5 y y=14: ya no hay apoyo ahí
  // arriba, el primer sólido que queda es en y=15.
  for (let y = 5; y < 15; y++) {
    mascara.datos[y * mascara.ancho + 8] = 0;
  }

  const resultado = resolverCaida(mascara, 8);

  assert.deepEqual(resultado, { tipo: "reposo", y: 14 });
});

test("terreno-4: sin sólido en toda la columna -- caída al vacío por el borde inferior", () => {
  const mascara = crearMascaraVacia(20, 20); // toda de aire

  const resultado = resolverCaida(mascara, 10);

  assert.deepEqual(resultado, { tipo: "eliminada" });
});
