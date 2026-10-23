import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ct-5: ningún tamaño de letra del HUD HTML se escribe a mano en px. Todo
// fontSize, font y lineHeight pasa por tamTexto(), que es lo que permite
// «Texto grande» y fija el mínimo de 14 px.
const CARPETA = join(process.cwd(), "src/juego/hud");

const PATRONES: readonly RegExp[] = [
  /fontSize:\s*[\d.]+/,
  /font:\s*["'`]\s*(?:(?:bold|italic|\d{3})\s+)*[\d.]+px/,
  /lineHeight:\s*["'`][\d.]+px/,
];

export function lineasConTamanoAMano(codigo: string): number[] {
  return codigo
    .split("\n")
    .map((linea, i) => ({ linea, n: i + 1 }))
    .filter(({ linea }) => !linea.trim().startsWith("//") && PATRONES.some((p) => p.test(linea)))
    .map(({ n }) => n);
}

function ficheros(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? ficheros(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : [],
  );
}

test("ct-5: ningún .tsx del HUD escribe un tamaño de letra en px a mano", () => {
  const fallos: string[] = [];
  for (const f of ficheros(CARPETA)) {
    for (const n of lineasConTamanoAMano(readFileSync(f, "utf8"))) fallos.push(`${f.replace(process.cwd() + "/", "")}:${n}`);
  }
  assert.deepEqual(fallos, [], `tamaños a mano (usa tamTexto): ${fallos.join(", ")}`);
});

test("ct-5: caso negativo, la guardia detecta 12px a mano y deja pasar tamTexto", () => {
  assert.deepEqual(lineasConTamanoAMano('style={{ font: "12px system-ui" }}'), [1]);
  assert.deepEqual(lineasConTamanoAMano("style={{ fontSize: 11 }}"), [1]);
  assert.deepEqual(lineasConTamanoAMano('style={{ lineHeight: "12px" }}'), [1]);
  assert.deepEqual(lineasConTamanoAMano("style={{ font: `600 ${tamTexto(14)} system-ui` }}"), []);
  assert.deepEqual(lineasConTamanoAMano("style={{ fontSize: tamTexto(14), lineHeight: 1.2 }}"), []);
});
