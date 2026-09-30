import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS, buscarArma } from "@/sim/armas/catalogo";

// mos-5: comprobación genérica y reutilizable -- cualquier arma futura que
// declare notaAyuda/bromaPropia (arma-granada-espoleta, arma-mina-adherente)
// pasa por aquí sin tocar este test.
test("mos-5: toda arma con notaAyuda declara una frase no vacía de una sola línea", () => {
  for (const arma of CATALOGO_ARMAS) {
    if (arma.notaAyuda === undefined) continue;
    assert.ok(arma.notaAyuda.trim().length > 0, `${arma.id}: notaAyuda vacía`);
    assert.ok(!arma.notaAyuda.includes("\n"), `${arma.id}: notaAyuda tiene más de una línea`);
  }
});

test("mos-5: toda arma con bromaPropia declara al menos una broma de disparo y una de impacto", () => {
  for (const arma of CATALOGO_ARMAS) {
    if (arma.bromaPropia === undefined) continue;
    assert.ok(arma.bromaPropia.disparo.length > 0, `${arma.id}: bromaPropia.disparo vacía`);
    assert.ok(arma.bromaPropia.impacto.length > 0, `${arma.id}: bromaPropia.impacto vacía`);
    for (const frase of [...arma.bromaPropia.disparo, ...arma.bromaPropia.impacto]) {
      assert.ok(frase.trim().length > 0, `${arma.id}: broma propia vacía`);
    }
  }
});

// mos-5: la mosca en concreto -- nombre/descripción consistentes con el
// catálogo, aviso de que no vuela recta, y al menos una broma propia de
// disparo y una de impacto.
test("mos-5: mosca-cojonera tiene nombre, descripción, aviso y bromas propias", () => {
  const mosca = buscarArma("mosca-cojonera");
  assert.equal(mosca.nombre, "Mosca Cojonera");
  assert.ok(mosca.descripcion.trim().length > 0);
  assert.ok(mosca.notaAyuda !== undefined && mosca.notaAyuda.length > 0, "falta notaAyuda");
  assert.ok(mosca.bromaPropia !== undefined, "falta bromaPropia");
  assert.ok(mosca.bromaPropia!.disparo.length >= 1);
  assert.ok(mosca.bromaPropia!.impacto.length >= 1);
});
