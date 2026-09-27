import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { colocarNaves } from "@/sim/naves/colocacion";
import { reiniciarContadorVuelosSimulados, vuelosSimuladosTotales } from "@/sim/fisica/vuelo";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";
import type { ParametrosMundo } from "@/sim/partida/tipos";

// imp-10 (no camino crítico -- se anota si falla, no bloquea el bloque): el
// casco real hace que colocarNaves pruebe más disparos por sistema que
// antes (imp-9), y cada intento de viabilidad es un vuelo real completo.
// Este test presupuesta que ese coste extra sigue dentro de lo razonable
// para el arranque de una partida.
const NUM_SEMILLAS = 100;
const P95_MAXIMO_MS = 400;
const PRESUPUESTO_VUELOS_TOTAL = 6000;
const MUNDO: ParametrosMundo = {
  ancho: MUNDO_ANCHO,
  alto: MUNDO_ALTO,
  gravedad: 1,
  deriva: 0,
  etiquetaDeriva: "ninguna",
};

test("imp-10: crear una partida tiene p95 < 400ms en 100 semillas y ninguna semilla supera 6.000 vuelos simulados", () => {
  const duracionesMs: number[] = [];
  let vuelosMaximosEnUnaCreacion = 0;

  for (let semilla = 0; semilla < NUM_SEMILLAS; semilla++) {
    reiniciarContadorVuelosSimulados();
    const inicio = process.hrtime.bigint();
    colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla));
    const fin = process.hrtime.bigint();
    duracionesMs.push(Number(fin - inicio) / 1e6);
    vuelosMaximosEnUnaCreacion = Math.max(vuelosMaximosEnUnaCreacion, vuelosSimuladosTotales());
  }

  duracionesMs.sort((a, b) => a - b);
  const indiceP95 = Math.floor(duracionesMs.length * 0.95);
  const p95 = duracionesMs[indiceP95];
  assert.ok(p95 < P95_MAXIMO_MS, `p95 de creación de partida (${p95.toFixed(1)}ms) supera el presupuesto de ${P95_MAXIMO_MS}ms`);

  // El presupuesto de 6.000 vuelos (esp-8/imp-10) es por CADA creación de
  // partida, no acumulado sobre las 100 semillas de la muestra -- por eso el
  // contador se reinicia entre semillas y se compara el máximo, no la suma.
  assert.ok(
    vuelosMaximosEnUnaCreacion <= PRESUPUESTO_VUELOS_TOTAL,
    `una creación de partida llegó a ${vuelosMaximosEnUnaCreacion} vuelos simulados, por encima del presupuesto de ${PRESUPUESTO_VUELOS_TOTAL}`,
  );
});
