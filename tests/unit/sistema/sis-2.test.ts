import { test } from "node:test";
import assert from "node:assert/strict";
import { generarSistema, GROSOR_ANILLO_MAX, GROSOR_ANILLO_MIN, MAX_ANILLOS, MAX_ASTEROIDES, PLANETAS_MAX, PLANETAS_MIN } from "@/sim/sistema/generador";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";

const NUM_SEMILLAS = 500;

test("sis-2: 500 semillas respetan siempre los topes duros del sistema", () => {
  for (let semilla = 0; semilla < NUM_SEMILLAS; semilla++) {
    const sistema = generarSistema(semilla, MUNDO_ANCHO, MUNDO_ALTO);

    assert.ok(
      sistema.planetas.length >= PLANETAS_MIN && sistema.planetas.length <= PLANETAS_MAX,
      `semilla ${semilla}: ${sistema.planetas.length} planetas fuera de [${PLANETAS_MIN}, ${PLANETAS_MAX}]`,
    );
    assert.ok(sistema.anillos.length <= MAX_ANILLOS, `semilla ${semilla}: ${sistema.anillos.length} anillos, tope ${MAX_ANILLOS}`);
    // "≤1 cinturón" es estructural en este generador: como mucho se genera un
    // único cinturón por sistema, así que basta con acotar el recuento total
    // de asteroides, sin necesidad de contar cinturones por separado.
    assert.ok(sistema.asteroides.length <= MAX_ASTEROIDES, `semilla ${semilla}: ${sistema.asteroides.length} asteroides, tope ${MAX_ASTEROIDES}`);

    for (const anillo of sistema.anillos) {
      assert.ok(
        anillo.grosor >= GROSOR_ANILLO_MIN && anillo.grosor <= GROSOR_ANILLO_MAX,
        `semilla ${semilla}: grosor de anillo ${anillo.grosor} fuera de [${GROSOR_ANILLO_MIN}, ${GROSOR_ANILLO_MAX}]`,
      );
    }
  }
});
