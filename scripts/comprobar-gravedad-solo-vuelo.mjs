#!/usr/bin/env node
// nav-4: la gravedad de N cuerpos tira de los proyectiles en vuelo, nunca
// de las naves -- "todo tira de todo" es la confusión natural al leer el
// diseño, y este grep es la barrera contra ella. calcularAceleracionGravitatoria
// solo puede llamarse desde simularVuelo (src/sim/fisica/vuelo.ts); cualquier
// otro sitio -- en particular algo que reciba naves -- es una fuga.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIRECTORIO = "src/sim";
const PATRON_LLAMADA = /calcularAceleracionGravitatoria\(/;
const FICHEROS_PERMITIDOS = new Set(["src/sim/fisica/vuelo.ts", "src/sim/gravedad/nCuerpos.ts"]);

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
    if (FICHEROS_PERMITIDOS.has(relativo)) continue;
    const contenido = await readFile(fichero, "utf8");
    if (PATRON_LLAMADA.test(contenido)) {
      infracciones.push(relativo);
    }
  }

  if (infracciones.length > 0) {
    console.error("calcularAceleracionGravitatoria llamada fuera de src/sim/fisica/vuelo.ts (nav-4):");
    for (const linea of infracciones) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log("OK: calcularAceleracionGravitatoria solo se llama desde simularVuelo (nav-4).");
}

main();
