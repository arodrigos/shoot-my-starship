import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";

// gra-5: nombre, descripción, bromas propias y un texto de ayuda que explica
// en una frase que la cuenta empieza al disparar, no al tocar. La cobertura
// genérica de "toda arma con notaAyuda/bromaPropia" ya vive en mos-5.test.ts
// (que la nombra explícitamente); este test es el específico de la granada.
test("gra-5: la Granada de Espoleta tiene nombre, descripción, bromas propias y un aviso de que la cuenta empieza al disparar", () => {
  const granada = buscarArma("granada-de-espoleta");
  assert.equal(granada.nombre, "Granada de Espoleta");
  assert.ok(granada.descripcion.trim().length > 0);

  assert.ok(granada.notaAyuda !== undefined && granada.notaAyuda.length > 0, "falta notaAyuda");
  assert.ok(!granada.notaAyuda!.includes("\n"), "notaAyuda tiene más de una línea");
  // La frase tiene que dejar explícito que la cuenta arranca al DISPARAR y
  // no al TOCAR -- justo la confusión que este criterio existe para evitar.
  assert.match(granada.notaAyuda!, /disparar/i);
  assert.match(granada.notaAyuda!, /tocar/i);

  assert.ok(granada.bromaPropia !== undefined, "falta bromaPropia");
  assert.ok(granada.bromaPropia!.disparo.length >= 1);
  assert.ok(granada.bromaPropia!.impacto.length >= 1);
});
