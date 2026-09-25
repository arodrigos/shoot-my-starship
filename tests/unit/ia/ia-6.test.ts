import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio, crearGeneradorAleatorio } from "@/sim/aleatorio";
import { decidirTurnoIA } from "@/sim/ia/decidir";
import { PERSONALIDADES } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const ORIGEN_X = 300;
const ESCENARIOS = 50;
const SOLAPAMIENTO_MAXIMO = 0.6;

function elegirArmaPorEscenario(personalidad: Personalidad, objetivos: readonly number[], mascara: ReturnType<typeof crearMascaraPlana>): string[] {
  return objetivos.map((objetivoX, indice) =>
    decidirTurnoIA({
      mascara,
      origenX: ORIGEN_X,
      objetivoX,
      gravedad: 1.0,
      deriva: 0,
      ancho: ANCHO,
      alto: ALTO,
      personalidad,
      // Misma semilla por índice de escenario en las tres personalidades:
      // así el solapamiento que se mide es el de la POLÍTICA de arma, no el
      // de qué punto del generador le tocó a cada una.
      aleatorio: crearEstadoAleatorio(indice),
      ultimoIntento: null,
    }).entrada.arma,
  );
}

function solapamiento(a: readonly string[], b: readonly string[]): number {
  let coincidencias = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) coincidencias++;
  }
  return coincidencias / a.length;
}

test("ia-6: ante los mismos 50 escenarios, ninguna pareja de personalidades coincide en el arma en más del 60%", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const generador = crearGeneradorAleatorio(555);
  const objetivos = Array.from({ length: ESCENARIOS }, () => ORIGEN_X + 200 + Math.floor(generador() * 1400));

  const elecciones = new Map(PERSONALIDADES.map((p) => [p.id, elegirArmaPorEscenario(p, objetivos, mascara)]));

  for (let i = 0; i < PERSONALIDADES.length; i++) {
    for (let j = i + 1; j < PERSONALIDADES.length; j++) {
      const a = PERSONALIDADES[i];
      const b = PERSONALIDADES[j];
      const pct = solapamiento(elecciones.get(a.id)!, elecciones.get(b.id)!);
      assert.equal(pct <= SOLAPAMIENTO_MAXIMO, true, `${a.nombre} y ${b.nombre} coinciden en el ${(pct * 100).toFixed(0)}% de los 50 escenarios`);
    }
  }
});

test("ia-6: cada personalidad tiene su propio banco de frases, no vacío y sin frases compartidas", () => {
  for (const personalidad of PERSONALIDADES) {
    assert.equal(personalidad.bancoDeFrases.length > 0, true, `${personalidad.nombre}: banco de frases vacío`);
  }

  for (let i = 0; i < PERSONALIDADES.length; i++) {
    for (let j = i + 1; j < PERSONALIDADES.length; j++) {
      const a = PERSONALIDADES[i];
      const b = PERSONALIDADES[j];
      const compartidas = a.bancoDeFrases.filter((frase) => b.bancoDeFrases.includes(frase));
      assert.deepEqual(compartidas, [], `${a.nombre} y ${b.nombre} comparten frases: ${compartidas.join(", ")}`);
    }
  }
});
