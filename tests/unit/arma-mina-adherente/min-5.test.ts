import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";

// min-5 (camino crítico): la ayuda de la Mina dice explícitamente cuándo empieza
// su cuenta -- "al pegarse, no al disparar" (armas-recorte retiró la Granada,
// con la que se contrastaba). La cobertura genérica de "toda arma con
// notaAyuda/bromaPropia" ya vive en mos-5.test.ts; este test es el
// específico de la mina.
test("min-5: el Gancho Pegajoso tiene nombre, descripción, bromas propias y un aviso de que la cuenta empieza al pegarse", () => {
  const mina = buscarArma("gancho-pegajoso");
  assert.equal(mina.nombre, "Gancho Pegajoso");
  assert.ok(mina.descripcion.trim().length > 0);

  assert.ok(mina.notaAyuda !== undefined && mina.notaAyuda.length > 0, "falta notaAyuda");
  assert.ok(!mina.notaAyuda!.includes("\n"), "notaAyuda tiene más de una línea");
  // La frase tiene que dejar explícito que la cuenta arranca al PEGARSE y no
  // al DISPARAR -- la confusión que este
  // criterio existe para evitar.
  assert.match(mina.notaAyuda!, /pegar/i);
  assert.match(mina.notaAyuda!, /disparar/i);

  assert.ok(mina.bromaPropia !== undefined, "falta bromaPropia");
  assert.ok(mina.bromaPropia!.disparo.length >= 1);
  assert.ok(mina.bromaPropia!.impacto.length >= 1);
});

test("min-5: la Mina cuenta desde que se pega y su ayuda no promete contar al tocar", () => {
  const mina = buscarArma("gancho-pegajoso");
  assert.equal(mina.comportamiento.tipo, "adherente-con-mecha");
  assert.doesNotMatch(mina.notaAyuda!, /tocar/i);
});
