import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { generarSistema } from "@/sim/sistema/generador";
import { hashSistema, MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";

const execFileAsync = promisify(execFile);

const FUENTES_DE_NO_DETERMINISMO = [/Math\.random/, /Date\.now/, /performance\.now/, /\bwindow\b/, /\bdocument\b/];

test("sis-5: el código del generador no contiene ninguna fuente de no-determinismo conocida", async () => {
  const ruta = path.resolve(process.cwd(), "src/sim/sistema/generador.ts");
  const contenido = await readFile(ruta, "utf8");

  for (const patron of FUENTES_DE_NO_DETERMINISMO) {
    assert.ok(!patron.test(contenido), `${ruta} contiene ${patron}`);
  }
});

test("sis-5: la misma semilla produce el mismo sistema en dos ejecuciones independientes del proceso", () => {
  // Complementa la comprobación textual de arriba: un no-determinismo que no
  // sea una de las fuentes conocidas (p.ej. orden de iteración de un Map o
  // un Set) no se ve en el grep pero sí rompería este hash, igual que hace
  // nucleo-4 para la partida completa.
  const a = hashSistema(generarSistema(555, MUNDO_ANCHO, MUNDO_ALTO));
  const b = hashSistema(generarSistema(555, MUNDO_ANCHO, MUNDO_ALTO));
  assert.equal(a, b);
});

test("sis-5: el guion comprobar-sin-math-random.mjs detecta un Math.random colado en src/sim", async () => {
  const rutaFuga = path.resolve(process.cwd(), "src/sim/sistema/__fuga-temporal-sis-5.ts");
  await writeFile(rutaFuga, "export const fugaDeAzar = (): number => Math.random();\n", "utf8");

  try {
    await assert.rejects(
      execFileAsync("node", ["scripts/comprobar-sin-math-random.mjs"], { cwd: process.cwd() }),
      /Command failed/,
    );
  } finally {
    await unlink(rutaFuga);
  }
});
