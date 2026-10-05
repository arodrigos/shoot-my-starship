import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.resolve("scripts/comprobar-sin-math-random.mjs");

// Ejecuta la guarda de CI sobre un src/sim de mentira: es lo que el
// gatekeeper hizo a mano para probar que atrapa lo que dice atrapar.
function ejecutarGuarda(codigo: string): number {
  const raiz = mkdtempSync(path.join(tmpdir(), "guarda-"));
  mkdirSync(path.join(raiz, "src/sim/balistica"), { recursive: true });
  writeFileSync(path.join(raiz, "src/sim/balistica/dispersion.ts"), codigo);
  try {
    execFileSync("node", [SCRIPT], { cwd: raiz, stdio: "pipe" });
    return 0;
  } catch (error) {
    return (error as { status: number }).status;
  }
}

for (const llamada of ["Math.random()", "Date.now()", "performance.now()"]) {
  test(`potencia-dispersion-2: la guarda de CI falla con ${llamada} en src/sim`, () => {
    assert.equal(ejecutarGuarda(`export const x = ${llamada};\n`), 1);
  });
}

test("potencia-dispersion-2: la guarda deja pasar código determinista y comentarios que nombran el reloj", () => {
  assert.equal(ejecutarGuarda("// nada de Date.now ni Math.random aquí\n/* performance.now tampoco */\nexport const x = 1;\n"), 0);
});
