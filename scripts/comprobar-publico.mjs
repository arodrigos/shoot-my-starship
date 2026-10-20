#!/usr/bin/env node
// hig-1: el repo es público y lo ya borrado sigue en el historial, así que
// lo que no debe salir de la casa se frena antes de entrar: ids de run,
// nombres de infraestructura y rutas de máquina. Mira solo lo versionado
// (git ls-files) para que node_modules o .next no den falsos positivos.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Los nombres de infraestructura y las rutas de máquina no pueden vivir en
// este fichero: el repo es público y escribirlos aquí ya los publica. Llegan
// del secret COMPROBAR_PUBLICO_PATRONES de Actions (enmascarado en los logs)
// como JSON: [["nombre", "regex"], ...]. Sin él la comprobación falla: una
// guarda que pasa en silencio sin sus patrones es peor que ninguna.
function patronesPrivados() {
  const crudo = process.env.COMPROBAR_PUBLICO_PATRONES;
  const fallar = (motivo) => {
    console.error(`comprobar-publico: ${motivo}; sin los patrones privados no se puede comprobar nada.`);
    process.exit(2);
  };
  if (!crudo || !crudo.trim()) fallar("falta la variable COMPROBAR_PUBLICO_PATRONES (secret de Actions)");
  let pares;
  try {
    pares = JSON.parse(crudo);
  } catch {
    fallar("COMPROBAR_PUBLICO_PATRONES no es JSON válido");
  }
  if (!Array.isArray(pares) || pares.length === 0) fallar("COMPROBAR_PUBLICO_PATRONES no trae ningún patrón");
  return pares.map((par, i) => {
    if (!Array.isArray(par) || par.length !== 2 || typeof par[0] !== "string" || typeof par[1] !== "string" || !par[1]) {
      fallar(`el patrón ${i + 1} de COMPROBAR_PUBLICO_PATRONES no es ["nombre", "regex"]`);
    }
    try {
      return { nombre: par[0], re: new RegExp(par[1], "i") };
    } catch {
      return fallar(`el patrón ${i + 1} de COMPROBAR_PUBLICO_PATRONES no es una regex válida`);
    }
  });
}

const PATRONES = [{ nombre: "id de run", re: /[0-9]{8}-[0-9]{6}-[0-9a-f]{4}/ }, ...patronesPrivados()];
const EXCLUIDOS = new Set(["package-lock.json"]);

// Los ficheros extra permiten probar el caso negativo con uno temporal sin
// versionar: `node scripts/comprobar-publico.mjs /tmp/fichero`.
const versionados = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\0")
  .filter((f) => f && !EXCLUIDOS.has(f));
const ficheros = [...versionados, ...process.argv.slice(2)];

const hallazgos = [];
for (const fichero of ficheros) {
  let texto;
  try {
    texto = readFileSync(fichero, "utf8");
  } catch {
    continue;
  }
  if (texto.includes("\0")) continue;
  texto.split("\n").forEach((linea, i) => {
    for (const { nombre, re } of PATRONES) {
      if (re.test(linea)) hallazgos.push(`${fichero}:${i + 1}: ${nombre}`);
    }
  });
}

if (hallazgos.length > 0) {
  console.error(`comprobar-publico: ${hallazgos.length} hallazgo(s) que no deben estar en un repo público:`);
  for (const h of hallazgos) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`comprobar-publico: OK (${ficheros.length} ficheros)`);
