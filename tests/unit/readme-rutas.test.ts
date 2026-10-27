import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Un README que cita ficheros que ya no existen se desfasa en silencio: este
// test lo hace saltar en el CI en cuanto una ruta citada deja de existir.
const RAIZ = process.cwd();
const PREFIJOS = ["src/", "tests/", "docs/", "scripts/"];

export function rutasCitadas(texto: string): string[] {
  const rutas = new Set<string>();
  for (const m of texto.matchAll(/`([^`\s]+)`/g)) {
    const candidata = m[1];
    if (PREFIJOS.some((p) => candidata.startsWith(p)) && !/[*<>{}]/.test(candidata)) rutas.add(candidata);
  }
  return [...rutas];
}

describe("README: rutas citadas", () => {
  test("detecta solo rutas del repo entre comillas invertidas", () => {
    assert.deepEqual(rutasCitadas("`src/a.ts` y `npm run x` y `docs/b.md` `src/**/*.ts`"), ["src/a.ts", "docs/b.md"]);
  });

  test("toda ruta citada existe", () => {
    const readme = readFileSync(join(RAIZ, "README.md"), "utf8");
    const rutas = rutasCitadas(readme);
    assert.ok(rutas.length > 0);
    const faltan = rutas.filter((r) => !existsSync(join(RAIZ, r)));
    assert.deepEqual(faltan, []);
  });
});
