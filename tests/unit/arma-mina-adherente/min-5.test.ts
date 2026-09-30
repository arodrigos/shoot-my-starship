import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";

// min-5 (camino crítico): la Mina y la Granada son dos armas DISTINTAS del
// catálogo, con comportamiento distinto y ayudas que dicen explícitamente
// cuándo empieza cada cuenta -- la granada "al disparar, no al tocar", la
// mina "al pegarse, no al disparar". La cobertura genérica de "toda arma con
// notaAyuda/bromaPropia" ya vive en mos-5.test.ts; este test es el
// específico de la mina, en el mismo estilo que gra-5.test.ts para la granada.
test("min-5: el Gancho Pegajoso tiene nombre, descripción, bromas propias y un aviso de que la cuenta empieza al pegarse", () => {
  const mina = buscarArma("gancho-pegajoso");
  assert.equal(mina.nombre, "Gancho Pegajoso");
  assert.ok(mina.descripcion.trim().length > 0);

  assert.ok(mina.notaAyuda !== undefined && mina.notaAyuda.length > 0, "falta notaAyuda");
  assert.ok(!mina.notaAyuda!.includes("\n"), "notaAyuda tiene más de una línea");
  // La frase tiene que dejar explícito que la cuenta arranca al PEGARSE y no
  // al DISPARAR -- justo lo contrario de la granada, y la confusión que este
  // criterio existe para evitar.
  assert.match(mina.notaAyuda!, /pegar/i);
  assert.match(mina.notaAyuda!, /disparar/i);

  assert.ok(mina.bromaPropia !== undefined, "falta bromaPropia");
  assert.ok(mina.bromaPropia!.disparo.length >= 1);
  assert.ok(mina.bromaPropia!.impacto.length >= 1);
});

test("min-5: la Mina y la Granada son dos entradas distintas del catálogo, con comportamiento de cuenta distinto", () => {
  const mina = buscarArma("gancho-pegajoso");
  const granada = buscarArma("granada-de-espoleta");

  assert.notEqual(mina.id, granada.id);
  assert.notEqual(mina.comportamiento.tipo, granada.comportamiento.tipo);
  assert.equal(mina.comportamiento.tipo, "adherente-con-mecha");
  assert.equal(granada.comportamiento.tipo, "mecha");

  // Las dos ayudas se contradicen a propósito en qué dispara la cuenta: la
  // granada dice "tocar" (la mina NO debe decirlo, porque ella cuenta desde
  // que se pega, no desde que toca por primera vez algo en vuelo -- son el
  // mismo verbo pero momentos distintos del diseño) y la mina dice "pegar"
  // (que la granada no menciona en absoluto).
  assert.doesNotMatch(mina.notaAyuda!, /tocar/i);
  assert.doesNotMatch(granada.notaAyuda!, /pegar/i);
});
