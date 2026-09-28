import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { encontrarInfracciones, DIRECTORIOS_A_REVISAR } from "../../../scripts/comprobar-sin-lectura-canvas.mjs";

// cie-5: el guardia real de este repositorio, ejecutado contra el repositorio
// real, no encuentra ninguna infracción -- incluida ahora la escena de
// producción src/juego/escenas (con eñe), que el guardia original (escrito
// como "src/juego/scenes", sin eñe) nunca llegó a mirar.
test("cie-5: el guardia real vigila src/juego/escenas (con eñe), el directorio de la escena de producción", () => {
  assert.ok(
    DIRECTORIOS_A_REVISAR.includes("src/juego/escenas"),
    "el guardia tiene que listar 'src/juego/escenas' (con eñe), no solo 'src/juego/scenes'",
  );
});

test("cie-5: el guardia real no encuentra infracciones en el repositorio actual", async () => {
  const raiz = path.resolve(process.cwd());
  const infracciones = await encontrarInfracciones(raiz);
  assert.deepEqual(infracciones, []);
});

// Caso negativo (issue de este mismo bloque: un guardia que apunta al
// directorio equivocado pasa siempre y parece que protege). Se fabrica un
// árbol de ficheros temporal con la MISMA forma que el repo real (incluida
// la carpeta "src/juego/scenes" sin eñe, para demostrar que el guardia no se
// conforma con vigilar esa y se cuela una getImageData en "escenas") y se
// comprueba que el guardia real la detecta.
test("cie-5 (caso negativo): una getImageData introducida a propósito en src/juego/escenas se detecta", async () => {
  const raiz = await mkdtemp(path.join(tmpdir(), "cie-5-"));
  try {
    const dirEscenas = path.join(raiz, "src/juego/escenas");
    const dirScenes = path.join(raiz, "src/juego/scenes");
    await mkdir(dirEscenas, { recursive: true });
    await mkdir(dirScenes, { recursive: true });
    await writeFile(
      path.join(dirEscenas, "Partida.ts"),
      "export function pintar(contexto: CanvasRenderingContext2D) {\n  return contexto.getImageData(0, 0, 1, 1);\n}\n",
    );
    await writeFile(path.join(dirScenes, "Sandbox.ts"), "export const inofensivo = true;\n");

    const infracciones = await encontrarInfracciones(raiz, ["src/juego/scenes", "src/juego/escenas"], new Set());

    assert.equal(infracciones.length, 1);
    assert.match(infracciones[0], /src\/juego\/escenas\/Partida\.ts/);
    assert.match(infracciones[0], /getImageData/);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});
