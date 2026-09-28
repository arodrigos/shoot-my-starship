import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { encontrarInfracciones } from "../../../scripts/comprobar-activos.mjs";

test("cie-3: el guardia real no encuentra infracciones en el repositorio actual", async () => {
  const raiz = path.resolve(process.cwd());
  const infracciones = await encontrarInfracciones(raiz);
  assert.deepEqual(infracciones, []);
});

// Caso negativo: un PNG añadido a propósito bajo src/ tiene que detectarse,
// para demostrar que el guardia sabe fallar y no solo "parece proteger".
test("cie-3 (caso negativo): un PNG añadido a propósito en src/ se detecta", async () => {
  const raiz = await mkdtemp(path.join(tmpdir(), "cie-3-png-"));
  try {
    const dir = path.join(raiz, "src/juego/terreno");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "planeta.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const infracciones = await encontrarInfracciones(raiz, ["src", "public"]);

    assert.equal(infracciones.length, 1);
    assert.match(infracciones[0], /src\/juego\/terreno\/planeta\.png/);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

// Segundo caso negativo: una URL externa de fuente (next/font o un CDN de
// activos) referenciada en código también tiene que detectarse -- no solo
// los binarios, que es la forma más obvia y menos probable de que esto se
// rompa; una fuente de Google es la forma real en que un proyecto Next.js
// suele introducir un activo externo sin darse cuenta.
test("cie-3 (caso negativo): una referencia a fonts.googleapis.com en código se detecta", async () => {
  const raiz = await mkdtemp(path.join(tmpdir(), "cie-3-fuente-"));
  try {
    const dir = path.join(raiz, "src/app");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "layout.tsx"),
      "// <link href=\"https://fonts.googleapis.com/css2?family=Inter\" rel=\"stylesheet\" />\nexport default function Layout() { return null; }\n",
    );

    const infracciones = await encontrarInfracciones(raiz, ["src", "public"]);

    assert.equal(infracciones.length, 1);
    assert.match(infracciones[0], /src\/app\/layout\.tsx/);
    assert.ok(infracciones[0].includes("fonts.googleapis.com"));
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});
