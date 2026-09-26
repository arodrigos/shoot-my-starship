import { test } from "node:test";
import assert from "node:assert/strict";
import { generarSistema, MARGEN_CORREDOR_SUPERIOR, SEPARACION_MINIMA } from "@/sim/sistema/generador";
import { AIRE } from "@/sim/terreno/mascara";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";

const NUM_SEMILLAS = 500;
// Cualquier fila de este rango está garantizada libre por construcción
// (ver MARGEN_CORREDOR_SUPERIOR en el generador): basta una para probar que
// el corredor lateral existe, no hace falta recorrerlas todas.
const FILA_CORREDOR = Math.floor(MARGEN_CORREDOR_SUPERIOR / 2);

test("sis-3: 500 semillas no producen ningún planeta solapado", () => {
  for (let semilla = 0; semilla < NUM_SEMILLAS; semilla++) {
    const { planetas } = generarSistema(semilla, MUNDO_ANCHO, MUNDO_ALTO);

    for (let i = 0; i < planetas.length; i++) {
      for (let j = i + 1; j < planetas.length; j++) {
        const a = planetas[i];
        const b = planetas[j];
        const distancia = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        const minima = a.radio + b.radio + SEPARACION_MINIMA;
        assert.ok(
          distancia >= minima,
          `semilla ${semilla}: planetas ${a.id}/${b.id} a distancia ${distancia}, mínima exigida ${minima}`,
        );
      }
    }
  }
});

test("sis-3: 500 semillas dejan siempre un corredor de aire de lado a lado", () => {
  for (let semilla = 0; semilla < NUM_SEMILLAS; semilla++) {
    const { mascara } = generarSistema(semilla, MUNDO_ANCHO, MUNDO_ALTO);

    for (let x = 0; x < mascara.ancho; x++) {
      assert.equal(
        mascara.datos[FILA_CORREDOR * mascara.ancho + x],
        AIRE,
        `semilla ${semilla}: la fila de corredor no está libre en x=${x}`,
      );
    }
  }
});
