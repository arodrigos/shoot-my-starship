import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

// ms-4: el README lleva los títulos que exige el traspaso y, al ser un repo
// público, ninguna referencia a la infraestructura.
const TITULOS = ["Cómo jugar", "Presupuesto y precios", "Escudos y propulsores", "Eventos del universo", "Muerte súbita", "Música y sonido"];

async function leerReadme(): Promise<string> {
  return readFile(path.resolve(process.cwd(), "README.md"), "utf8");
}

for (const titulo of TITULOS) {
  test(`ms-4: el README tiene el apartado «${titulo}»`, async () => {
    const readme = await leerReadme();
    assert.match(readme, new RegExp(`^#{2,3} ${titulo}$`, "m"));
  });
}

test("el README no menciona la infraestructura (patrones del secret de la guarda)", async (t) => {
  // S-04 (auditoría 2026-10): los términos ya no viven en este fichero. Salen
  // del mismo secret que scripts/comprobar-publico.mjs, COMPROBAR_PUBLICO_PATRONES,
  // en JSON: [["nombre", "regex"], ...]. En Actions llega siempre; sin él, el
  // criterio no se puede comprobar y el test falla. En local se salta.
  const crudo = process.env.COMPROBAR_PUBLICO_PATRONES;
  if (!crudo || !crudo.trim()) {
    if (process.env.CI) assert.fail("falta COMPROBAR_PUBLICO_PATRONES: sin los patrones privados no se puede comprobar ms-4");
    t.skip("sin COMPROBAR_PUBLICO_PATRONES (solo llega en Actions)");
    return;
  }
  const pares = JSON.parse(crudo) as unknown;
  assert.ok(Array.isArray(pares) && pares.length > 0, "COMPROBAR_PUBLICO_PATRONES no es una lista de pares");
  const readme = await leerReadme();
  for (const par of pares as [string, string][]) {
    assert.doesNotMatch(readme, new RegExp(par[1], "i"), `el README menciona «${par[0]}»`);
  }
});
