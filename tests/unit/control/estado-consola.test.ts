import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  ANCLAJES_CONSOLA,
  ESTADOS_CONSOLA,
  sanearAnclajeConsola,
  sanearEstadoConsola,
  siguienteAnclaje,
} from "../../../src/juego/hud/estadoConsola";

test("con-1: cualquier valor guardado da un estado y un anclaje válidos", () => {
  fc.assert(
    fc.property(fc.option(fc.string(), { nil: null }), fc.option(fc.string(), { nil: null }), (a, b) => {
      assert.ok(ESTADOS_CONSOLA.includes(sanearEstadoConsola(a, b)));
      assert.ok(ANCLAJES_CONSOLA.includes(sanearAnclajeConsola(a)));
    }),
  );
});

test("con-1: los valores válidos se respetan y los corruptos caen al valor por defecto", () => {
  for (const estado of ESTADOS_CONSOLA) assert.equal(sanearEstadoConsola(estado, null), estado);
  for (const anclaje of ANCLAJES_CONSOLA) assert.equal(sanearAnclajeConsola(anclaje), anclaje);
  assert.equal(sanearAnclajeConsola("xyz"), "abajo-centro");
  assert.equal(sanearEstadoConsola("xyz", null), "desplegada");
  assert.equal(sanearEstadoConsola(null, "1"), "minima");
  assert.equal(sanearEstadoConsola("oculta", "1"), "oculta");
});

test("con-1: «Mover» recorre las tres posiciones y vuelve al principio", () => {
  let actual: (typeof ANCLAJES_CONSOLA)[number] = ANCLAJES_CONSOLA[0];
  const vistos = new Set<string>();
  for (let i = 0; i < 3; i++) {
    vistos.add(actual);
    actual = siguienteAnclaje(actual);
  }
  assert.equal(vistos.size, 3);
  assert.equal(actual, ANCLAJES_CONSOLA[0]);
});
