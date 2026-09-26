#!/usr/bin/env node
// render-espacio (esp-7): render-3.e2e.ts es el único presupuesto de
// rendimiento con GPU real de este producto -- exigir p95<=50ms bajo
// throttle es la comprobación que se saltea en CI (ubuntu-latest no tiene
// GPU) pero que debe seguir intacta para quien la corra en una máquina con
// GPU de verdad. Este guion falla si el umbral se ha relajado o si el skip
// de CI ha desaparecido (lo que dejaría el test corriendo, y fallando, en
// un runner sin GPU).
import { readFile } from "node:fs/promises";
import path from "node:path";

const RUTA_POR_DEFECTO = "tests/e2e/render-3.e2e.ts";
const LINEA_SKIP_CI =
  'test.skip(!!process.env.CI, "ubuntu-latest no tiene GPU: SwiftShader por software no alcanza el presupuesto ni en reposo (hueco declarado en el entregable)");';
const LINEA_UMBRAL = "expect(p95).toBeLessThanOrEqual(50);";

function comprobarContenido(contenido) {
  const problemas = [];
  if (!contenido.includes(LINEA_SKIP_CI)) {
    problemas.push("falta (o se ha cambiado) el test.skip que omite este test en CI sin GPU");
  }
  if (!contenido.includes(LINEA_UMBRAL)) {
    problemas.push("falta (o se ha relajado) el umbral p95 <= 50ms");
  }
  return problemas;
}

async function main() {
  const ruta = process.argv[2] ?? RUTA_POR_DEFECTO;
  const contenido = await readFile(path.resolve(process.cwd(), ruta), "utf8");
  const problemas = comprobarContenido(contenido);

  if (problemas.length > 0) {
    console.error(`render-3.e2e.ts (${ruta}) parece haberse debilitado (esp-7):`);
    for (const problema of problemas) {
      console.error(`  - ${problema}`);
    }
    process.exit(1);
  }

  console.log("OK: render-3.e2e.ts mantiene su skip de CI y su umbral p95<=50ms intactos (esp-7).");
}

main();
