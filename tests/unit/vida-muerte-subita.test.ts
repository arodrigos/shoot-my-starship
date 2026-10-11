import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { colocarNaves } from "@/sim/naves/colocacion";
import { nivelDanio } from "@/sim/naves/geometriaCasco";
import { acotarIntegridad, INTEGRIDAD_MAXIMA, porcentajeIntegridad } from "@/sim/naves/vida";
import { DRENAJE_BASE, drenajeDeRonda, RONDA_MUERTE_SUBITA } from "@/sim/partida/muerteSubita";
import { INTEGRIDAD_MAXIMA_IA_ESCUDO } from "@/sim/equipo/catalogo";
import { VIDA_CORAZON, VIDA_TORMENTA } from "@/sim/universo/objetos";

const MUNDO = { ancho: 1200, alto: 1600, gravedad: 0, deriva: 0, etiquetaDeriva: "" };

test("vid-1: la vida máxima es 150 y de ella cuelgan el escudo de la IA, el corazón y la tormenta", () => {
  assert.equal(INTEGRIDAD_MAXIMA, 150);
  assert.equal(INTEGRIDAD_MAXIMA_IA_ESCUDO, 75);
  assert.equal(VIDA_CORAZON, 75);
  assert.equal(VIDA_TORMENTA, 35);
});

test("vid-1: toda nave empieza colocada con la vida máxima", () => {
  const colocacion = colocarNaves(3, MUNDO, crearEstadoAleatorio(3), 4, [true, true, true, true]);
  assert.equal(colocacion.naves.length, 4);
  for (const nave of colocacion.naves) assert.equal(nave.integridad, INTEGRIDAD_MAXIMA);
});

test("vid-1: el casco y la barra trabajan sobre la fracción de la vida máxima", () => {
  assert.equal(porcentajeIntegridad(INTEGRIDAD_MAXIMA), 100);
  // Un impacto de 18 deja la barra al 88 %.
  assert.equal(Math.round(porcentajeIntegridad(INTEGRIDAD_MAXIMA - 18)), 88);
  assert.equal(nivelDanio(INTEGRIDAD_MAXIMA), "alta");
  assert.equal(nivelDanio(INTEGRIDAD_MAXIMA / 2), "media");
  assert.equal(nivelDanio(INTEGRIDAD_MAXIMA / 4), "baja");
});

test("vid-2: la muerte súbita empieza en la ronda 14 y drena 4, 8, 12…", () => {
  assert.equal(RONDA_MUERTE_SUBITA, 14);
  assert.equal(DRENAJE_BASE, 4);
  assert.equal(drenajeDeRonda(13), 0);
  assert.deepEqual([14, 15, 16, 17].map(drenajeDeRonda), [4, 8, 12, 16]);
});

// Invariante: toda partida con muerte súbita termina, porque lo drenado hasta
// la ronda 22 ya supera la vida máxima.
test("invariante: para toda ronda r ≥ 22 lo drenado desde la 14 es ≥ INTEGRIDAD_MAXIMA", () => {
  fc.assert(
    fc.property(fc.integer({ min: 22, max: 200 }), (ronda) => {
      let suma = 0;
      for (let r = RONDA_MUERTE_SUBITA; r <= ronda; r++) suma += drenajeDeRonda(r);
      assert.ok(suma >= INTEGRIDAD_MAXIMA);
    }),
  );
  let hasta21 = 0;
  for (let r = RONDA_MUERTE_SUBITA; r <= 21; r++) hasta21 += drenajeDeRonda(r);
  assert.ok(hasta21 < INTEGRIDAD_MAXIMA, "la 22 es la primera ronda en que nadie sobrevive, no antes");
});

test("invariante: 0 ≤ integridad ≤ INTEGRIDAD_MAXIMA tras cualquier cambio de vida", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: INTEGRIDAD_MAXIMA }), fc.integer({ min: -400, max: 400 }), (integridad, cambio) => {
      const resultado = acotarIntegridad(integridad + cambio);
      assert.ok(resultado >= 0 && resultado <= INTEGRIDAD_MAXIMA);
    }),
  );
});
