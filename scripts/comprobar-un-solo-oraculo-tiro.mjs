#!/usr/bin/env node
// impacto-naves (imp-8): UN SOLO ORÁCULO DE TIRO. src/sim/balistica/busqueda.ts
// tenía su propia condición de parada privada (paraba a 60px 2D del objetivo,
// sin comprobar daño real) -- se borró en este bloque. Este guardia impide que
// vuelva a aparecer disfrazada: ningún fichero de src/sim/balistica puede
// importar el módulo de vuelo ni el integrador de pasos directamente, porque
// eso es exactamente lo que hace falta para construirse una condición de
// parada propia. El único camino permitido hacia un vuelo real es
// resolverDisparo (src/sim/armas/resolver.ts), que barridoRejilla/
// existeTiroViable ya usan.
import { readFile, readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const DIRECTORIO = "src/sim/balistica";
const PROHIBIDO_MODULO_VUELO = /from\s*["']@\/sim\/fisica\/vuelo["']/;
const PROHIBIDO_INTEGRADOR_PASO = /\bintegrarPasoProyectil\b/;

async function ficherosTypeScript(directorio) {
  const entradas = await readdir(directorio, { withFileTypes: true }).catch(() => []);
  const resultados = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      resultados.push(...(await ficherosTypeScript(ruta)));
    } else if (entrada.name.endsWith(".ts")) {
      resultados.push(ruta);
    }
  }
  return resultados;
}

async function encontrarInfracciones(directorio) {
  const infracciones = [];
  const raiz = process.cwd();
  for (const fichero of await ficherosTypeScript(directorio)) {
    const relativo = path.relative(raiz, fichero).split(path.sep).join("/");
    const contenido = await readFile(fichero, "utf8");
    if (PROHIBIDO_MODULO_VUELO.test(contenido) || PROHIBIDO_INTEGRADOR_PASO.test(contenido)) {
      infracciones.push(relativo);
    }
  }
  return infracciones;
}

// Caso negativo (imp-8): sin este autotest, el guardia podría estar
// comprobando un patrón que nunca coincide con nada y pasaría siempre en
// verde por las razones equivocadas. Se ejercita en cada ejecución de CI, no
// solo una vez a mano.
async function comprobarQueElGuardiaDetectaUnaSegundaParada() {
  const ficheroFicticio = path.join(DIRECTORIO, "_autotest_segunda_parada.ts");
  const contenidoConSegundaParada = [
    'import { simularVuelo } from "@/sim/fisica/vuelo";',
    "",
    "// Fichero temporal del autotest de comprobar-un-solo-oraculo-tiro.mjs:",
    "// una segunda condición de parada, exactamente lo que el guardia debe atrapar.",
    "export function existeSegundoOraculo() {",
    "  return typeof simularVuelo;",
    "}",
    "",
  ].join("\n");

  await writeFile(ficheroFicticio, contenidoConSegundaParada, "utf8");
  try {
    const infracciones = await encontrarInfracciones(DIRECTORIO);
    const detectado = infracciones.includes(path.relative(process.cwd(), ficheroFicticio).split(path.sep).join("/"));
    if (!detectado) {
      throw new Error(
        "el autotest negativo introdujo una segunda condición de parada a propósito y el guardia NO la detectó -- está roto",
      );
    }
  } finally {
    await rm(ficheroFicticio, { force: true });
  }
}

async function main() {
  await comprobarQueElGuardiaDetectaUnaSegundaParada();

  const infracciones = await encontrarInfracciones(DIRECTORIO);
  if (infracciones.length > 0) {
    console.error("Segunda condición de parada de vuelo en src/sim/balistica (rompe el oráculo único, imp-8):");
    for (const linea of infracciones) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log("OK: un solo oráculo de tiro en src/sim/balistica, y el autotest negativo lo confirma (imp-8).");
}

main();
