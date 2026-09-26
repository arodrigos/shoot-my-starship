import { test } from "node:test";
import assert from "node:assert/strict";
import { generarSistema } from "@/sim/sistema/generador";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";

const NUM_EJECUCIONES = 20;
const PRESUPUESTO_MS = 150;
const PEOR_CASO = { numPlanetas: 6, numAnillos: 2, numAsteroides: 40 } as const;

function mediana(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[mitad - 1] + ordenados[mitad]) / 2 : ordenados[mitad];
}

test("sis-6: el peor caso (6 planetas, 2 anillos, 40 asteroides) genera en menos de 150ms de mediana", () => {
  const duraciones: number[] = [];

  for (let i = 0; i < NUM_EJECUCIONES; i++) {
    const inicio = process.hrtime.bigint();
    const sistema = generarSistema(1000 + i, MUNDO_ANCHO, MUNDO_ALTO, PEOR_CASO);
    const fin = process.hrtime.bigint();

    assert.equal(sistema.planetas.length, PEOR_CASO.numPlanetas);
    assert.equal(sistema.anillos.length, PEOR_CASO.numAnillos);
    assert.equal(sistema.asteroides.length, PEOR_CASO.numAsteroides);

    duraciones.push(Number(fin - inicio) / 1_000_000);
  }

  const medianaMs = mediana(duraciones);
  assert.ok(medianaMs < PRESUPUESTO_MS, `mediana ${medianaMs.toFixed(2)}ms supera el presupuesto de ${PRESUPUESTO_MS}ms`);
});
