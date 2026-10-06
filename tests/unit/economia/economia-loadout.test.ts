import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { FACILIDAD_MEDIDA_PCT } from "@/sim/armas/facilidadMedida";
import { medirCatalogo } from "../../utils/medirArmas";

const IDS = CATALOGO_ARMAS.map((arma) => arma.id);

async function ficheros(directorio: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const lotes = await Promise.all(
    entradas.map((entrada) =>
      entrada.isDirectory() ? ficheros(path.join(directorio, entrada.name)) : Promise.resolve([path.join(directorio, entrada.name)]),
    ),
  );
  return lotes.flat();
}

test("economia-loadout-4: ninguna ruta del código fuente concede crédito por daño", async () => {
  for (const fichero of (await ficheros(path.resolve(process.cwd(), "src"))).filter((f) => /\.(ts|tsx)$/.test(f))) {
    const contenido = await readFile(fichero, "utf8");
    assert.ok(!/ingresoPorDanio|TASA_INGRESO_POR_DANIO/.test(contenido), `${fichero} aún referencia el ingreso por daño`);
  }
});

// economia-loadout-6: la facilidad que enseña la pantalla es la medida de verdad
test("economia-loadout-6: la facilidad estática de la pantalla de selección coincide con la medición viva", () => {
  assert.deepEqual(Object.keys(FACILIDAD_MEDIDA_PCT).sort(), [...IDS].sort());
  for (const metrica of medirCatalogo()) {
    const id = CATALOGO_ARMAS.find((arma) => arma.nombre === metrica.nombre)!.id;
    assert.equal(FACILIDAD_MEDIDA_PCT[id], Math.round(metrica.facilidad * 1000) / 10, `${metrica.nombre}: la tabla estática se ha quedado vieja`);
  }
});

// economia-loadout-8
test("economia-loadout-8: el README cita el número real de armas y el precio y el papel de cada una", async () => {
  const readme = await readFile(path.resolve(process.cwd(), "README.md"), "utf8");
  const filas = readme.split("\n").filter((linea) => /^\| .+ \| \d+ \| .+ \|$/.test(linea));
  assert.equal(filas.length, CATALOGO_ARMAS.length, "el README tiene que tabular todas las armas del catálogo");
  for (const arma of CATALOGO_ARMAS) {
    assert.ok(
      filas.some((fila) => fila.startsWith(`| ${arma.nombre} | ${arma.coste} | ${arma.rol} |`)),
      `el README no recoge el precio y el papel actuales de ${arma.nombre}`,
    );
  }
  const numeros = ["quince", String(CATALOGO_ARMAS.length)];
  assert.ok(numeros.some((n) => readme.includes(n)));
  assert.equal(CATALOGO_ARMAS.length, 15, "si el catálogo cambia, el texto 'quince armas' del README hay que revisarlo");
  for (const tema of [/360°/, /relevo/i, /de 1 a 4 humanos|2 a 4 naves/, /recalibrada/, /dispersión/, /No hay ingreso por daño/]) {
    assert.match(readme, tema);
  }
});
