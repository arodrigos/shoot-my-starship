#!/usr/bin/env node
// nucleo-4: todo el azar de src/sim sale del generador con semilla que
// vive en el estado (ver src/sim/aleatorio.ts); Math.random rompería el
// determinismo del que dependen las repeticiones, los tests y el
// multijugador por intercambio de entradas. El test de nucleo-4 atrapa el
// azar que se cuela por otra vía (orden de iteración); este grep atrapa la
// llamada olvidada a cualquier fuente de azar o de reloj -- Math.random,
// Date.now y performance.now -- porque una dispersión que dependa del reloj
// rompe la reproducibilidad igual que una que dependa de Math.random
// (potencia-dispersion-2). Las dos mitades hacen falta.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIRECTORIO = "src/sim";
const PATRON = /Math\.random|Date\.now|performance\.now/;
// Los comentarios mencionan estas llamadas para explicar por qué no se usan;
// solo el código ejecutable cuenta.
const COMENTARIOS = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;

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
    if (PATRON.test(contenido.replace(COMENTARIOS, ""))) {
      infracciones.push(relativo);
    }
  }

  if (infracciones.length > 0) {
    console.error("Math.random, Date.now o performance.now en src/sim (rompen el determinismo, nucleo-4, potencia-dispersion-2):");
    for (const linea of infracciones) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log("OK: sin Math.random, Date.now ni performance.now en src/sim (nucleo-4).");
}

main();
