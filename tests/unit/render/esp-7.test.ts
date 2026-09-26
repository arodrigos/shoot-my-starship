import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const RUTA_REAL = path.resolve(process.cwd(), "tests/e2e/render-3.e2e.ts");

test("esp-7: comprobar-render-3.mjs acepta el render-3.e2e.ts real, con su skip de CI y su umbral intactos", async () => {
  await execFileAsync("node", ["scripts/comprobar-render-3.mjs"], { cwd: process.cwd() });
});

// El propio render-3.e2e.ts NO se toca (esp-7 lo exige byte a byte): se
// trabaja sobre una copia temporal, para que este test demuestre que el
// guion de verdad detecta un umbral relajado sin arriesgar el fichero real.
test("esp-7: comprobar-render-3.mjs detecta un umbral p95 relajado", async () => {
  const contenidoReal = await readFile(RUTA_REAL, "utf8");
  const contenidoDebilitado = contenidoReal.replace(
    "expect(p95).toBeLessThanOrEqual(50);",
    "expect(p95).toBeLessThanOrEqual(500);",
  );
  assert.notEqual(contenidoDebilitado, contenidoReal, "la sustitución del umbral no ha encontrado la línea esperada");

  const directorio = await mkdtemp(path.join(tmpdir(), "esp-7-"));
  const rutaFixture = path.join(directorio, "render-3-debilitado.e2e.ts");
  await writeFile(rutaFixture, contenidoDebilitado, "utf8");

  try {
    await assert.rejects(
      execFileAsync("node", ["scripts/comprobar-render-3.mjs", rutaFixture], { cwd: process.cwd() }),
      /Command failed/,
    );
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test("esp-7: comprobar-render-3.mjs detecta que el skip de CI ha desaparecido", async () => {
  const contenidoReal = await readFile(RUTA_REAL, "utf8");
  // Greedy hasta fin de línea (no [^)]*): el propio mensaje del skip lleva
  // paréntesis dentro ("(hueco declarado...)"), que cortarían la búsqueda
  // en el paréntesis equivocado si fuera perezosa/negada.
  const contenidoDebilitado = contenidoReal.replace(
    /test\.skip\(!!process\.env\.CI,.*\);\n/,
    "",
  );
  assert.notEqual(contenidoDebilitado, contenidoReal, "la eliminación del skip no ha encontrado la línea esperada");

  const directorio = await mkdtemp(path.join(tmpdir(), "esp-7-"));
  const rutaFixture = path.join(directorio, "render-3-sin-skip.e2e.ts");
  await writeFile(rutaFixture, contenidoDebilitado, "utf8");

  try {
    await assert.rejects(
      execFileAsync("node", ["scripts/comprobar-render-3.mjs", rutaFixture], { cwd: process.cwd() }),
      /Command failed/,
    );
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});
