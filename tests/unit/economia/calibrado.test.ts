import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import type { Arma } from "@/sim/armas/tipos";
import { PREMIO_LOTERIA, PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import {
  BANDA_VALOR,
  calcularParametros,
  comprasHastaAgotar,
  DESVIACIONES_DECLARADAS,
  mediana,
  renderizarInforme,
  TOLERANCIA_CURVA,
  tablaDePrecios,
} from "../../utils/calibrarEconomia";

const parametros = calcularParametros();
const informe = readFileSync(join(process.cwd(), "docs", "calibracion-economia.md"), "utf8");

// Invariante 1: vale para cualquier catálogo, no solo para el de hoy.
test("calibrado-1 (propiedad): la base y el premio son fijos (600 y 150) con cualquier catálogo", () => {
  const armaConCoste = (coste: number): Arma => ({ ...CATALOGO_ARMAS[0], id: `s-${coste}`, coste, utilitaria: false });
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 5, max: 300 }), { minLength: 1, maxLength: 20 }), (costes) => {
      const calibrados = calcularParametros(costes.map(armaConCoste));
      assert.equal(calibrados.medianaPrecios, mediana(costes));
      assert.equal(calibrados.presupuestoBase, 600);
      assert.equal(calibrados.premioLoteria, 150);
    }),
    { numRuns: 200 },
  );
});

// cal-1 / invariante 4
test("calibrado-4: parametros.ts coincide con la calibración del catálogo vigente", () => {
  assert.equal(PRESUPUESTO_BASE, parametros.presupuestoBase);
  assert.equal(PREMIO_LOTERIA, parametros.premioLoteria);
});

test("calibrado-4: docs/calibracion-economia.md coincide con parámetros y precios del catálogo", () => {
  assert.match(informe, new RegExp(`\`PRESUPUESTO_BASE\` fijo, sin arrastre entre partidas: \\*\\*${PRESUPUESTO_BASE} cr\\*\\*`));
  assert.match(informe, new RegExp(`\`PREMIO_LOTERIA\` fijo: \\*\\*${PREMIO_LOTERIA} cr\\*\\*`));
  for (const fila of tablaDePrecios()) {
    assert.ok(informe.includes(`| ${fila.nombre} | ${fila.coste} | ${fila.danioMaximo} |`), `${fila.nombre}: el informe no recoge su coste ${fila.coste}`);
  }
});

test("calibrado-4: la parte determinista del informe se regenera idéntica", () => {
  const regenerado = renderizarInforme(0, null).split("## Partidas de 3 IAs")[0];
  assert.equal(informe.split("## Partidas de 3 IAs")[0], regenerado);
});

// cal-1 / turnos-por-estrategia
// Transitorio: con los precios de la base de 850 y el saldo ya en 600, el medio
// hace 7 compras. El bloque calibrado-600 reescala los precios y devuelve la
// banda objetivo (9-11 compras medias).
test("calibrado-1: el presupuesto de 600 da compras medias, pocas al caro y muchas al barato", () => {
  const medio = comprasHastaAgotar("medio", PRESUPUESTO_BASE);
  const caro = comprasHastaAgotar("caro", PRESUPUESTO_BASE);
  const barato = comprasHastaAgotar("barato", PRESUPUESTO_BASE);
  assert.ok(medio >= 6 && medio <= 11, `medio: ${medio} compras`);
  assert.ok(caro <= 8, `caro: ${caro} compras`);
  assert.ok(barato >= 9, `barato: ${barato} compras`);
});

test("calibrado-1: con la base fija de 600 y dos escudos pagados el medio sigue haciendo ≥ 3 compras", () => {
  assert.ok(comprasHastaAgotar("medio", PRESUPUESTO_BASE, 2 * 90) >= 3);
});

// cal-2 / invariantes 2 y 3
test("calibrado-2: cada arma de pago con daño está a ≤ 15 % de la curva o con la desviación declarada", () => {
  for (const fila of tablaDePrecios()) {
    if (DESVIACIONES_DECLARADAS[fila.id] !== undefined) {
      assert.ok(informe.includes(`\`${fila.id}\``), `${fila.id}: la desviación declarada tiene que estar en el informe`);
      continue;
    }
    assert.ok(fila.desviacion <= TOLERANCIA_CURVA, `${fila.id}: coste ${fila.coste} a ${(fila.desviacion * 100).toFixed(0)} % de la curva (${fila.curva})`);
  }
});

test("calibrado-2: ninguna arma de pago es trampa ni ganga dominante (daño esperado por crédito en [0,6; 1,6] × mediana)", () => {
  for (const fila of tablaDePrecios()) {
    if (DESVIACIONES_DECLARADAS[fila.id] !== undefined) continue;
    assert.ok(fila.valorRelativo >= BANDA_VALOR[0] && fila.valorRelativo <= BANDA_VALOR[1], `${fila.id}: valor ${fila.valorRelativo.toFixed(2)} fuera de la banda`);
  }
});

test("calibrado-2: las desviaciones declaradas son solo las que de verdad se salen", () => {
  for (const fila of tablaDePrecios()) {
    const fuera = fila.desviacion > TOLERANCIA_CURVA || fila.valorRelativo < BANDA_VALOR[0] || fila.valorRelativo > BANDA_VALOR[1];
    assert.equal(DESVIACIONES_DECLARADAS[fila.id] !== undefined, fuera, `${fila.id}: declarada=${DESVIACIONES_DECLARADAS[fila.id] !== undefined}, fuera de banda=${fuera}`);
  }
});
