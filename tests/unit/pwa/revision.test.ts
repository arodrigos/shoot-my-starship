import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { calcularRevision } from "@/juego/pwa/revision";

const textoOpcional = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant(""),
  fc.constant("  \n"),
  fc.stringMatching(/^[0-9a-f]{40}$/),
  fc.stringMatching(/^[0-9a-f]{40}$/).map((s) => `  ${s}\n`),
);

test("pwa-3: la revisión nunca es vacía ni lleva espacios", () => {
  fc.assert(fc.property(textoOpcional, textoOpcional, (sha, git) => {
    const revision = calcularRevision({ shaDespliegue: sha ?? undefined, salidaGit: git }, () => "uuid-de-build");
    return revision.length > 0 && !/\s/.test(revision);
  }));
});

test("pwa-3: prefiere el sha de despliegue, después git y por último el uuid", () => {
  assert.equal(calcularRevision({ shaDespliegue: "abc1234", salidaGit: "fff" }, () => "u"), "abc1234");
  assert.equal(calcularRevision({ shaDespliegue: "", salidaGit: "fff\n" }, () => "u"), "fff");
  assert.equal(calcularRevision({ shaDespliegue: " ", salidaGit: "" }, () => "u"), "u");
});
