#!/usr/bin/env node
// vuelo-extensible (vex-2): UNA SOLA DEFINICIÓN DE VUELO para la perturbación
// errática (mosca), la cuenta de la mecha (granada de espoleta) y la
// condición de adherencia (mina): las tres viven como funciones puras en
// src/sim/fisica/comportamientoExtendido.ts (más crearDetenerseConMecha en
// src/sim/armas/resolver.ts), y AnimadorProyectil.ts -- que ya reintegra el
// vuelo en el cliente paso a paso imitando simularVuelo -- tiene que
// CONSUMIRLAS, nunca reimplementarlas. Si el cliente calculara su propia
// perturbación o su propio temporizador, la animación y el disparo resuelto
// divergirían (dos físicas), rompiendo exactamente lo que este bloque existe
// para impedir. Mecánico a propósito, igual que comprobar-frontera-nucleo.mjs
// y comprobar-un-solo-oraculo-tiro.mjs.
import { readFile, readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const DIRECTORIO = "src/juego";

const FUNCIONES_NUCLEO = [
  "siguientePerturbacionErratica",
  "pasosDeMecha",
  "esComportamientoAdherente",
  "crearDetenerseConMecha",
  // prevision-real (pvr-4): calcularPrevisualizacion es, igual que las
  // anteriores, UNA SOLA DEFINICIÓN -- vive en src/sim/armas/previsualizacion.ts
  // y se consume, nunca se reimplementa en el cliente.
  "calcularPrevisualizacion",
];

// Los tres tipos de ComportamientoDeVuelo que este bloque introduce. Si el
// cliente rama sobre alguno de ellos, es porque necesita perturbación, mecha
// o adherencia -- y en ese caso tiene que importar la función del núcleo, no
// reinventarla.
const PATRON_RAMA_TIPO_EXTENDIDO = /\.tipo\s*===\s*["'](erratico|mecha|adherente-con-mecha)["']/;
const PATRON_IMPORT_NUCLEO = /from\s*["']@\/sim\/fisica\/comportamientoExtendido["']/;

// prevision-real (pvr-4): el hallazgo propio del diseño era "trayectoriaPreviaSVG",
// una parábola de gravedad uniforme calculada a mano en el HUD. Si ese nombre
// (o cualquier variante) reaparece en src/juego sin pasar por el oráculo real
// de previsualización, es la misma mentira volviendo a colarse.
const PATRON_NOMBRE_RETIRADO = /trayectoriaPrevia/i;
const PATRON_IMPORT_PREVISUALIZACION = /from\s*["']@\/sim\/armas\/previsualizacion["']/;

// Redeclarar cualquiera de las funciones del núcleo con el mismo nombre
// (function o const) es la forma más directa de "reimplementar en vez de
// importar": copiar y pegar la definición en vez de consumirla.
function patronRedeclaracion(nombre) {
  return new RegExp(`\\b(function|const)\\s+${nombre}\\b`);
}

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
    const contenido = await readFile(fichero, "utf8");

    for (const nombre of FUNCIONES_NUCLEO) {
      if (patronRedeclaracion(nombre).test(contenido)) {
        infracciones.push(`${relativo}: redeclara ${nombre} en vez de importarla del núcleo`);
      }
    }

    if (PATRON_RAMA_TIPO_EXTENDIDO.test(contenido) && !PATRON_IMPORT_NUCLEO.test(contenido)) {
      infracciones.push(
        `${relativo}: rama sobre un comportamiento de vuelo-extensible (erratico/mecha/adherente-con-mecha) sin importar las funciones puras de comportamientoExtendido.ts -- reimplementación sospechosa`,
      );
    }

    if (PATRON_NOMBRE_RETIRADO.test(contenido) && !PATRON_IMPORT_PREVISUALIZACION.test(contenido)) {
      infracciones.push(
        `${relativo}: menciona una trayectoria previa sin importar el oráculo real de src/sim/armas/previsualizacion.ts -- vuelve la parábola de gravedad uniforme calculada a mano (pvr-4)`,
      );
    }
  }
  return infracciones;
}

// Caso negativo (mismo patrón que comprobar-un-solo-oraculo-tiro.mjs): un
// fichero ficticio que rama sobre "erratico" con su propia perturbación, sin
// importar nada del núcleo -- si el guardia no lo atrapa, está roto.
async function comprobarQueElGuardiaDetectaUnaReimplementacion() {
  const ficheroFicticio = path.join(DIRECTORIO, "vuelo", "_autotest_perturbacion_propia.ts");
  const contenidoReimplementado = [
    'import type { ComportamientoDeVuelo } from "@/sim/armas/tipos";',
    "",
    "// Fichero temporal del autotest de comprobar-vuelo-unica-definicion.mjs:",
    "// una perturbación propia, exactamente lo que el guardia debe atrapar.",
    "export function perturbacionPropiaDelCliente(comportamiento: ComportamientoDeVuelo, t: number): number {",
    '  if (comportamiento.tipo === "erratico") {',
    "    return Math.sin(t) * comportamiento.magnitudPxS2;",
    "  }",
    "  return 0;",
    "}",
    "",
  ].join("\n");

  await writeFile(ficheroFicticio, contenidoReimplementado, "utf8");
  try {
    const infracciones = await encontrarInfracciones(DIRECTORIO);
    const relativoFicticio = path.relative(process.cwd(), ficheroFicticio).split(path.sep).join("/");
    const detectado = infracciones.some((linea) => linea.startsWith(`${relativoFicticio}:`));
    if (!detectado) {
      throw new Error("el autotest negativo introdujo una perturbación propia a propósito y el guardia NO la detectó -- está roto");
    }
  } finally {
    await rm(ficheroFicticio, { force: true });
  }
}

// Caso negativo de pvr-4: un fichero ficticio que menciona "trayectoriaPrevia"
// sin importar el oráculo real -- la reaparición exacta que el criterio pide
// vigilar.
async function comprobarQueElGuardiaDetectaUnaTrayectoriaPropia() {
  const ficheroFicticio = path.join(DIRECTORIO, "hud", "_autotest_trayectoria_propia.ts");
  const contenidoConTrayectoriaPropia = [
    "// Fichero temporal del autotest de comprobar-vuelo-unica-definicion.mjs:",
    "// una trayectoriaPreviaSVG calculada a mano, exactamente lo que el guardia debe atrapar.",
    "export function trayectoriaPreviaSVG(anguloGrados: number, potencia: number): string {",
    "  return `M0,0 Q${potencia},${anguloGrados} 60,60`;",
    "}",
    "",
  ].join("\n");

  await writeFile(ficheroFicticio, contenidoConTrayectoriaPropia, "utf8");
  try {
    const infracciones = await encontrarInfracciones(DIRECTORIO);
    const relativoFicticio = path.relative(process.cwd(), ficheroFicticio).split(path.sep).join("/");
    const detectado = infracciones.some((linea) => linea.startsWith(`${relativoFicticio}:`));
    if (!detectado) {
      throw new Error("el autotest negativo introdujo una trayectoriaPreviaSVG propia a propósito y el guardia NO la detectó -- está roto");
    }
  } finally {
    await rm(ficheroFicticio, { force: true });
  }
}

async function main() {
  await comprobarQueElGuardiaDetectaUnaReimplementacion();
  await comprobarQueElGuardiaDetectaUnaTrayectoriaPropia();

  const infracciones = await encontrarInfracciones(DIRECTORIO);
  if (infracciones.length > 0) {
    console.error("Posible segunda definición de vuelo en src/juego (rompe la unicidad de vuelo, vex-2):");
    for (const linea of infracciones) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log("OK: ninguna reimplementación de perturbación/mecha/adherencia en src/juego, y el autotest negativo lo confirma (vex-2).");
}

main();
