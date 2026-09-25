import { test } from "node:test";
import assert from "node:assert/strict";
import { BANCO_REACCIONES, combinacionesDelBanco, frasesPara } from "@/contenido/bancoReacciones";
import { crearSelectorFrases } from "@/contenido/selectorFrases";
import { TIPOS_EVENTO_HUMOR } from "@/sim/partida/eventos";

const MINIMO_FRASES_POR_COMBINACION = 6;
const PICKS_A_PROBAR = 40;

test("humor-3: hay al menos 6 frases por cada combinación de tipo de evento y personalidad", () => {
  const combinaciones = combinacionesDelBanco();
  assert.equal(
    combinaciones.length,
    Object.keys(BANCO_REACCIONES).length * TIPOS_EVENTO_HUMOR.length,
    "combinacionesDelBanco no recorre todas las personalidades x tipos de evento",
  );
  for (const { personalidadId, tipoEvento } of combinaciones) {
    const frases = frasesPara(personalidadId, tipoEvento);
    assert.equal(
      frases.length >= MINIMO_FRASES_POR_COMBINACION,
      true,
      `${personalidadId}/${tipoEvento}: ${frases.length} frases, se exigen al menos ${MINIMO_FRASES_POR_COMBINACION}`,
    );
  }
});

test("humor-3: en 40 elecciones consecutivas del mismo tipo no se repite ninguna hasta agotar el banco", () => {
  const selector = crearSelectorFrases(2024);
  const banco = frasesPara("chispa", "autoimpacto");
  const elegidas: string[] = [];
  for (let i = 0; i < PICKS_A_PROBAR; i++) {
    elegidas.push(selector.elegir("chispa", "autoimpacto"));
  }

  // Cada ciclo COMPLETO (alineado con el tamaño del banco, no cualquier
  // ventana deslizante -- entre dos ciclos la bolsa se vuelve a barajar
  // entera, así que una ventana a caballo entre dos ciclos sí puede repetir)
  // es una permutación: agota las 6 frases sin dejar ninguna fuera antes de
  // volver a barajar.
  for (let inicio = 0; inicio + banco.length <= elegidas.length; inicio += banco.length) {
    const ciclo = elegidas.slice(inicio, inicio + banco.length);
    const distintas = new Set(ciclo);
    assert.equal(distintas.size, banco.length, `ciclo [${inicio}, ${inicio + banco.length}) tiene repetidas: ${ciclo.join(" | ")}`);
  }

  // Ninguna frase se repite en dos elecciones consecutivas, ni siquiera
  // justo en el cruce entre el final de un ciclo y el arranque del
  // siguiente -- que es donde una bolsa de sorteo ingenua sí repetiría.
  for (let i = 1; i < elegidas.length; i++) {
    assert.notEqual(elegidas[i], elegidas[i - 1], `posiciones ${i - 1} y ${i} han dado la misma frase: "${elegidas[i]}"`);
  }
});

test("humor-3: dos semillas distintas no siempre empiezan por la misma frase", () => {
  const primeraEleccion = (semilla: number): string => crearSelectorFrases(semilla).elegir("la-contable", "arma-falla");

  const elecciones = new Set<string>();
  for (const semilla of [1, 2, 3, 4, 5, 6, 7, 8]) {
    elecciones.add(primeraEleccion(semilla));
  }

  assert.equal(elecciones.size > 1, true, "las 8 semillas distintas han producido siempre la misma primera frase");
});
