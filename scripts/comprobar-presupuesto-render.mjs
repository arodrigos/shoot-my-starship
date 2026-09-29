#!/usr/bin/env node
// presupuesto-render (pre-1): ningún efecto visual puede nacer sin declarar
// antes su techo de partículas y de objetos vivos en
// src/juego/efectos/registroEfectos.ts. El único punto autorizado para
// crear un emisor de partículas es src/juego/efectos/crearEmisorRegistrado.ts
// (que sí valida el techo contra el registro): este guardia falla si
// aparece un `.add.particles(` en cualquier otro fichero de src/juego, que
// es exactamente cómo un efecto nuevo se colaría sin pasar por el registro.
import { readFile, readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const DIRECTORIO = "src/juego";
const FICHERO_PERMITIDO = "src/juego/efectos/crearEmisorRegistrado.ts";
const PATRON_CREACION_EMISOR = /\.add\.particles\s*\(/;

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

async function encontrarInfracciones(directorio) {
  const infracciones = [];
  const raiz = process.cwd();
  for (const fichero of await ficherosTypeScript(directorio)) {
    const relativo = path.relative(raiz, fichero).split(path.sep).join("/");
    if (relativo === FICHERO_PERMITIDO) continue;
    const contenido = await readFile(fichero, "utf8");
    if (PATRON_CREACION_EMISOR.test(contenido)) {
      infracciones.push(relativo);
    }
  }
  return infracciones;
}

// Caso negativo (mismo patrón que los guardias existentes, p. ej.
// comprobar-un-solo-oraculo-tiro.mjs): sin este autotest, el guardia podría
// estar comprobando un patrón que nunca coincide con nada y pasaría siempre
// en verde por las razones equivocadas.
async function comprobarQueElGuardiaDetectaUnEmisorFueraDelRegistro() {
  const ficheroFicticio = path.join(DIRECTORIO, "_autotest_emisor_sin_registro.ts");
  const contenidoConEmisorSinRegistro = [
    "// Fichero temporal del autotest de comprobar-presupuesto-render.mjs:",
    "// un emisor creado sin pasar por crearEmisorRegistrado, exactamente lo",
    "// que el guardia debe atrapar.",
    "export function crearEmisorFicticio(escena) {",
    '  return escena.add.particles(0, 0, "textura-ficticia", { quantity: 0 });',
    "}",
    "",
  ].join("\n");

  await writeFile(ficheroFicticio, contenidoConEmisorSinRegistro, "utf8");
  try {
    const infracciones = await encontrarInfracciones(DIRECTORIO);
    const detectado = infracciones.includes(path.relative(process.cwd(), ficheroFicticio).split(path.sep).join("/"));
    if (!detectado) {
      throw new Error(
        "el autotest negativo introdujo un emisor de partículas fuera del registro a propósito y el guardia NO lo detectó -- está roto",
      );
    }
  } finally {
    await rm(ficheroFicticio, { force: true });
  }
}

async function main() {
  await comprobarQueElGuardiaDetectaUnEmisorFueraDelRegistro();

  const infracciones = await encontrarInfracciones(DIRECTORIO);
  if (infracciones.length > 0) {
    console.error(
      `Emisor de partículas creado fuera de ${FICHERO_PERMITIDO}, sin pasar por el registro de efectos (pre-1):`,
    );
    for (const linea of infracciones) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: ningún emisor de partículas se crea fuera de ${FICHERO_PERMITIDO}, y el autotest negativo lo confirma (pre-1).`,
  );
}

main();
