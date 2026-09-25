#!/usr/bin/env node
// nucleo-3: el núcleo (src/sim) es la frontera de la que depende todo el
// resto de la verificación de este producto -- si se cuela una referencia
// al navegador aquí, deja de ser cierto que un test de Node prueba lo mismo
// que ve un jugador. Mecánico a propósito, igual que
// comprobar-sin-lectura-canvas.mjs para terreno-6: import de "phaser",
// "react" o "next" (en cualquiera de sus formas, "next/...", "react-dom"),
// o referencia a los globals de navegador window, document o performance.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIRECTORIO = "src/sim";

const PATRONES_IMPORT_PROHIBIDO = [/from\s+["'](phaser)(\/|["'])/, /from\s+["'](react|react-dom)(\/|["'])/, /from\s+["'](next)(\/|["'])/];

// \b evita falsos positivos con identificadores propios que solo comparten
// substring (no hay ninguno hoy, pero es la forma correcta de escribirlo).
const PATRONES_GLOBAL_PROHIBIDO = [/\bwindow\b/, /\bdocument\b/, /\bperformance\b/];

async function ficherosTypeScript(directorio) {
  const entradas = await readdir(directorio, { withFileTypes: true }).catch(() => []);
  const resultados = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      resultados.push(...(await ficherosTypeScript(ruta)));
    } else if (entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx")) {
      resultados.push(ruta);
    }
  }
  return resultados;
}

async function main() {
  const raiz = process.cwd();
  const infracciones = [];
  const ficheros = await ficherosTypeScript(path.join(raiz, DIRECTORIO));

  for (const fichero of ficheros) {
    const relativo = path.relative(raiz, fichero).split(path.sep).join("/");
    const contenido = await readFile(fichero, "utf8");

    for (const patron of PATRONES_IMPORT_PROHIBIDO) {
      if (patron.test(contenido)) {
        infracciones.push(`${relativo}: importa un módulo prohibido (${patron})`);
      }
    }
    for (const patron of PATRONES_GLOBAL_PROHIBIDO) {
      if (patron.test(contenido)) {
        infracciones.push(`${relativo}: referencia un global de navegador (${patron})`);
      }
    }
  }

  if (infracciones.length > 0) {
    console.error("src/sim depende del navegador o de un framework, y no debería (nucleo-3):");
    for (const linea of infracciones) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log("OK: src/sim no importa phaser/react/next ni referencia window/document/performance (nucleo-3).");
}

main();
