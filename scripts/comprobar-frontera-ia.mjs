#!/usr/bin/env node
// ia-4: la capa de decisión (src/sim/ia) solo puede PROPONER una
// EntradaDeTurno -- nunca resolver el disparo ni tocar el terreno o el
// daño directamente, porque eso es responsabilidad exclusiva de
// avanzar()/resolverDisparo (el mismo camino que sigue un jugador humano).
// Si la IA pudiera llamar a resolverDisparo o a las huellas, un bug ahí
// rompería el terreno de forma distinta según quién dispara, y nucleo-6
// (misma interfaz para toda fuente) dejaría de ser cierto en la práctica.
// Mecánico a propósito, igual que comprobar-frontera-nucleo.mjs.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIRECTORIO = "src/sim/ia";
// Sintaxis de llamada/import, no de mención en un comentario explicativo
// (trazado.ts y decidir.ts citan resolverDisparo en prosa, legítimamente).
const PATRONES_PROHIBIDOS = [
  /\bresolverDisparo\s*\(/,
  /\baplicarHuellaCircular\s*\(/,
  /\baplicarHuellaCapsula\s*\(/,
  /\.datos\[[^\]]*\]\s*=/, // escritura directa en Mascara.datos
];

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
    for (const patron of PATRONES_PROHIBIDOS) {
      if (patron.test(contenido)) {
        infracciones.push(`${relativo}: usa algo reservado a avanzar()/resolverDisparo (${patron})`);
      }
    }
  }

  if (infracciones.length > 0) {
    console.error("src/sim/ia toca el terreno o el daño directamente, y no debería (ia-4):");
    for (const linea of infracciones) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log("OK: src/sim/ia solo propone EntradaDeTurno, nunca resuelve el disparo (ia-4).");
}

main();
