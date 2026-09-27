#!/usr/bin/env node
// armas-nuevas (arm-1): el catálogo es datos, nunca código. Este guardia
// falla si src/sim/armas/resolver.ts contiene una comparación contra el id
// de un arma en concreto (switch (arma.id) / if (arma.id === "...")): eso
// es exactamente cómo el resolutor deja de ser genérico sobre los ejes del
// catálogo y empieza a acumular un caso especial por arma añadida.
import { readFile, writeFile } from "node:fs/promises";

const FICHERO = "src/sim/armas/resolver.ts";
// Cubre tanto `arma.id === "x"` como `switch (arma.id)`, con comillas
// simples o dobles y espaciado variable.
const PATRON_RAMA_POR_ID = /\barma\.id\s*(===|==)\s*["'][\w-]+["']|switch\s*\(\s*arma\.id\s*\)/;

async function contieneRamaPorId(contenido) {
  return PATRON_RAMA_POR_ID.test(contenido);
}

// Caso negativo (mismo patrón que comprobar-un-solo-oraculo-tiro.mjs): sin
// este autotest, el guardia podría estar comprobando un patrón que nunca
// coincide con nada y pasaría siempre en verde por las razones equivocadas.
async function comprobarQueElGuardiaDetectaUnaRamaPorId(original) {
  const contaminado = `${original}\n// _autotest_comprobar-sin-ramas-por-arma:\nfunction _autotest() { return arma.id === "arma-inventada"; }\n`;
  await writeFile(FICHERO, contaminado, "utf8");
  try {
    const detectado = await contieneRamaPorId(contaminado);
    if (!detectado) {
      throw new Error("el autotest negativo introdujo una rama por id a propósito y el guardia NO la detectó -- está roto");
    }
  } finally {
    await writeFile(FICHERO, original, "utf8");
  }
}

async function main() {
  const original = await readFile(FICHERO, "utf8");

  await comprobarQueElGuardiaDetectaUnaRamaPorId(original);

  if (await contieneRamaPorId(original)) {
    console.error(`Rama por identificador de arma en ${FICHERO} (rompe armas-nuevas, arm-1): usa un eje del catálogo, no el id.`);
    process.exit(1);
  }

  console.log("OK: resolver.ts no ramifica por identificador de arma, y el autotest negativo lo confirma (arm-1).");
}

main();
