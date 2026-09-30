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

// proyectiles-siluetas (pyl-2): el render de proyectiles solo tiene permiso
// para mirar los ejes del arma (comportamiento, huella, efecto...) a través
// de familiaVisualDe, nunca el id de un arma en concreto -- mismo contrato
// que arm-1 (comprobar-sin-ramas-por-arma.mjs) pero para la silueta, no para
// el resolutor de daño. El diseño pide este check "como parte del guardia
// de presupuesto", así que vive aquí en vez de en un script nuevo.
const DIRECTORIO_PROYECTILES = "src/juego/proyectiles";
const PATRON_RAMA_POR_ID = /\barma\.id\s*(===|==)\s*["'][\w-]+["']|switch\s*\(\s*arma\.id\s*\)/;

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

async function encontrarRamasPorIdDeArma(directorio) {
  const infracciones = [];
  const raiz = process.cwd();
  for (const fichero of await ficherosTypeScript(directorio)) {
    const relativo = path.relative(raiz, fichero).split(path.sep).join("/");
    const contenido = await readFile(fichero, "utf8");
    if (PATRON_RAMA_POR_ID.test(contenido)) {
      infracciones.push(relativo);
    }
  }
  return infracciones;
}

// Mismo patrón de autotest negativo que comprobar-sin-ramas-por-arma.mjs:
// un fichero temporal con una rama por id a propósito, dentro del propio
// directorio de proyectiles, que el guardia debe atrapar.
async function comprobarQueElGuardiaDetectaUnaRamaPorIdEnProyectiles() {
  const ficheroFicticio = path.join(DIRECTORIO_PROYECTILES, "_autotest_rama_por_id.ts");
  const contenidoConRamaPorId = [
    "// Fichero temporal del autotest de comprobar-presupuesto-render.mjs (pyl-2):",
    "// una rama por id de arma, exactamente lo que este guardia debe atrapar.",
    'function _autotest(arma) { return arma.id === "arma-inventada"; }',
    "",
  ].join("\n");

  await writeFile(ficheroFicticio, contenidoConRamaPorId, "utf8");
  try {
    const infracciones = await encontrarRamasPorIdDeArma(DIRECTORIO_PROYECTILES);
    const detectado = infracciones.includes(path.relative(process.cwd(), ficheroFicticio).split(path.sep).join("/"));
    if (!detectado) {
      throw new Error(
        "el autotest negativo introdujo una rama por id de arma en src/juego/proyectiles a propósito y el guardia NO la detectó -- está roto",
      );
    }
  } finally {
    await rm(ficheroFicticio, { force: true });
  }
}

async function main() {
  await comprobarQueElGuardiaDetectaUnEmisorFueraDelRegistro();
  await comprobarQueElGuardiaDetectaUnaRamaPorIdEnProyectiles();

  const infraccionesEmisor = await encontrarInfracciones(DIRECTORIO);
  const infraccionesRamaPorId = await encontrarRamasPorIdDeArma(DIRECTORIO_PROYECTILES);

  if (infraccionesEmisor.length > 0) {
    console.error(
      `Emisor de partículas creado fuera de ${FICHERO_PERMITIDO}, sin pasar por el registro de efectos (pre-1):`,
    );
    for (const linea of infraccionesEmisor) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  if (infraccionesRamaPorId.length > 0) {
    console.error(`Rama por identificador de arma en el render de proyectiles (rompe pyl-2): usa un eje del catálogo, no el id.`);
    for (const linea of infraccionesRamaPorId) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: ningún emisor de partículas se crea fuera de ${FICHERO_PERMITIDO}, ningún render de proyectiles ramifica por id de arma, y ambos autotest negativos lo confirman (pre-1, pyl-2).`,
  );
}

main();
