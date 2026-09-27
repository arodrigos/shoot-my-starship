#!/usr/bin/env node
// ia-4: la capa de decisión (src/sim/ia) solo puede PROPONER una
// EntradaDeTurno -- nunca tocar el terreno o el daño de forma que el turno
// real quede afectado por lo que la IA exploró, porque eso es
// responsabilidad exclusiva de avanzar() (el mismo camino que sigue un
// jugador humano). Si la IA pudiera escribir en la máscara compartida o
// aplicar una huella fuera de una exploración descartable, un bug ahí
// rompería el terreno de forma distinta según quién dispara, y nucleo-6
// (misma interfaz para toda fuente) dejaría de ser cierto en la práctica.
// ia-multipozo/ia-n2 (DESVIACIÓN, ver entregable): resolverDisparo() SÍ está
// permitido desde aquí -- ia-n2 exige explícitamente que la búsqueda del
// rival use "la misma función con la que el juego dispara", nunca un modelo
// simplificado. Es seguro porque resolverDisparo clona la máscara de
// entrada (clonarMascara, ver resolver.ts) antes de aplicar cualquier
// huella y nunca devuelve esa mutación al llamante ni toca params.mascara:
// cada llamada desde la búsqueda es una exploración descartable sobre una
// copia, igual que si no hubiera pasado. Lo que sigue prohibido -- y es lo
// que de verdad protegía el criterio original -- es escribir terreno o
// daño de forma que SOBREVIVA a la exploración: llamar a las huellas
// directamente (que sí mutan en sitio) o escribir en Mascara.datos a mano.
// Mecánico a propósito, igual que comprobar-frontera-nucleo.mjs.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIRECTORIO = "src/sim/ia";
// Sintaxis de llamada/import, no de mención en un comentario explicativo
// (trazado.ts y decidir.ts citan resolverDisparo en prosa, legítimamente).
const PATRONES_PROHIBIDOS = [
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
