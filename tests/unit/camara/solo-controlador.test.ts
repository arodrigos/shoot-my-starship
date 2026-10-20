import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? ficheros(ruta) : /\.(ts|tsx)$/.test(n) ? [ruta] : [];
  });
}

// cam-8: solo el controlador mueve la cámara principal.
test("ningún fichero de src toca zoom, scroll, pan o seguimiento de la cámara fuera de controladorCamara.ts", () => {
  const prohibido = /cameras\.main\.(setZoom|zoomTo|pan|centerOn|setScroll|startFollow)\b/;
  const culpables = ficheros("src").filter((f) => !f.endsWith("controladorCamara.ts") && prohibido.test(readFileSync(f, "utf8")));
  assert.deepEqual(culpables, []);
});
