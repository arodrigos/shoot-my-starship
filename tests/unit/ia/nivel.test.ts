import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { calcularErrorInyectado } from "@/sim/ia/decidir";
import { aplicarNivel, esNivelIA, FACTOR_NIVEL, NIVELES_IA, type NivelIA } from "@/sim/ia/nivel";
import { PERSONALIDADES } from "@/sim/ia/personalidades";
import type { RangoDeError } from "@/sim/ia/tipos";

const personalidad = fc.constantFrom(...PERSONALIDADES);
const nivel = fc.constantFrom<NivelIA>(...NIVELES_IA);
const centro = (r: RangoDeError): number => (r.minimo + r.maximo) / 2;
const semianchura = (r: RangoDeError): number => (r.maximo - r.minimo) / 2;

test("niv-1: «normal» devuelve la misma referencia para cualquier personalidad", () => {
  fc.assert(fc.property(personalidad, (p) => assert.equal(aplicarNivel(p, "normal"), p)));
});

test("niv-4: cualquier nivel conserva el centro de cada rango y escala su semianchura por FACTOR_NIVEL", () => {
  fc.assert(
    fc.property(personalidad, nivel, (p, n) => {
      const q = aplicarNivel(p, n);
      for (const eje of ["anguloGrados", "potencia"] as const) {
        assert.ok(Math.abs(centro(q.error[eje]) - centro(p.error[eje])) < 1e-9);
        assert.ok(Math.abs(semianchura(q.error[eje]) - semianchura(p.error[eje]) * FACTOR_NIVEL[n]) < 1e-9);
      }
    }),
  );
});

test("niv-4: Bisagra sigue pasándose de fuerza (potencia centrada en 50) en todos los niveles", () => {
  const bisagra = PERSONALIDADES.find((p) => p.id === "almirante-bisagra")!;
  for (const n of NIVELES_IA) assert.ok(Math.abs(centro(aplicarNivel(bisagra, n).error.potencia) - 50) < 1e-9);
});

test("el orden de los factores es fácil > normal = 1 > difícil > 0", () => {
  assert.ok(FACTOR_NIVEL.facil > FACTOR_NIVEL.normal);
  assert.equal(FACTOR_NIVEL.normal, 1);
  assert.ok(FACTOR_NIVEL.normal > FACTOR_NIVEL.dificil && FACTOR_NIVEL.dificil > 0);
});

test("aplicarNivel solo cambia el campo error y no toca la entrada", () => {
  fc.assert(
    fc.property(personalidad, nivel, (p, n) => {
      const antes = JSON.stringify(p);
      const q = aplicarNivel(p, n);
      assert.equal(JSON.stringify(p), antes);
      assert.deepEqual({ ...q, error: p.error }, p);
    }),
  );
});

test("el nivel no cambia cuántas extracciones del generador sembrado consume un error", () => {
  fc.assert(
    fc.property(personalidad, fc.integer({ min: 0, max: 1_000_000 }), (p, semilla) => {
      const finales = NIVELES_IA.map((n) => calcularErrorInyectado(aplicarNivel(p, n), crearEstadoAleatorio(semilla)).aleatorio);
      assert.deepEqual(finales[0], finales[1]);
      assert.deepEqual(finales[2], finales[1]);
    }),
  );
});

test("esNivelIA solo acepta los tres identificadores", () => {
  fc.assert(fc.property(fc.anything(), (v) => assert.equal(esNivelIA(v), v === "facil" || v === "normal" || v === "dificil")));
});

test("niv-6: las descripciones de los rivales hablan de su estilo, no de dificultad", () => {
  for (const p of PERSONALIDADES) {
    assert.doesNotMatch(p.descripcion, /difícil|dificil|floja|fácil|facil|dificultad|primera partida|más\b.*de las tres/i, p.nombre);
  }
});
