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

test("ms-4: el README no nombra la infraestructura", async () => {
  const readme = await leerReadme();
  assert.doesNotMatch(readme, /VPS[12]|claude-fleet|\/home\/claude-user|tailscale|[0-9]{8}-[0-9]{6}-[0-9a-f]{4}/i);
});
