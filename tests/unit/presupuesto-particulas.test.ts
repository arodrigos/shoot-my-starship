import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { radioEfectoDeArma } from "@/sim/partida/detonaciones";
import {
  DURACION_ESCOMBROS_MS,
  DURACION_HUMO_MS,
  PresupuestoParticulas,
  planificarExplosion,
  techoGlobalDeParticulas,
} from "@/juego/efectos/planExplosion";

// Simula una explosión de Despedida con el mismo plan que usa la escena y un
// reloj propio: nunca hay temporizadores reales (issue #151).
function explotarDespedida(presupuesto: PresupuestoParticulas, ahoraMs: number) {
  const despedida = CATALOGO_ARMAS.find((a) => a.id === "despedida")!;
  return planificarExplosion({
    detonacion: { x: 0, y: 0, armaId: despedida.id, radioEfectoU: radioEfectoDeArma(despedida), danioAplicado: 55, sobre: "nave" },
    cssPorUnidad: 0.32,
    movimientoReducido: false,
    particulasConcedibles: (pedidas, duracionMs) => presupuesto.reservar(ahoraMs, pedidas, duracionMs),
    cantidadMaxEscombros: 16,
    cantidadMaxHumo: 10,
  });
}

for (const [anchoCss, techo] of [
  [360, 120],
  [1280, 240],
] as const) {
  test(`exp-3: 5 Despedidas simultáneas con ${anchoCss} px de ancho dejan ≤ ${techo} partículas vivas cada 16 ms y conservan destello y onda`, () => {
    assert.equal(techoGlobalDeParticulas(anchoCss), techo);
    const presupuesto = new PresupuestoParticulas(techo);
    const planes = Array.from({ length: 5 }, () => explotarDespedida(presupuesto, 0));
    for (const plan of planes) {
      assert.ok(plan.radioDestello > 0 && plan.radioOnda === 115, "destello y onda nunca se eliminan");
    }
    for (let t = 0; t <= DURACION_HUMO_MS + 100; t += 16) {
      assert.ok(presupuesto.vivas(t) <= techo, `en t=${t} ms hay ${presupuesto.vivas(t)} partículas, techo ${techo}`);
    }
    assert.equal(presupuesto.vivas(DURACION_HUMO_MS + 1), 0, "al terminar no queda nada vivo");
    assert.ok(planes[0].escombros > 0, "la primera explosión no se queda sin partículas");
  });
}

// Invariante 3: para cualquier secuencia de explosiones, en ningún instante
// hay más partículas vivas que el techo del viewport.
test("exp-3: ninguna secuencia de explosiones supera el techo del viewport", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(360, 599, 600, 1280),
      fc.array(fc.tuple(fc.integer({ min: 0, max: 3000 }), fc.integer({ min: 0, max: 60 })), { minLength: 1, maxLength: 40 }),
      (anchoCss, explosiones) => {
        const techo = techoGlobalDeParticulas(anchoCss);
        const presupuesto = new PresupuestoParticulas(techo);
        const ordenadas = [...explosiones].sort((a, b) => a[0] - b[0]);
        for (const [ahoraMs, danio] of ordenadas) {
          planificarExplosion({
            detonacion: { x: 0, y: 0, armaId: "x", radioEfectoU: 55, danioAplicado: danio, sobre: "nave" },
            cssPorUnidad: 0.32,
            movimientoReducido: false,
            particulasConcedibles: (pedidas, duracionMs) => presupuesto.reservar(ahoraMs, pedidas, duracionMs),
            cantidadMaxEscombros: 16,
            cantidadMaxHumo: 10,
          });
          assert.ok(presupuesto.vivas(ahoraMs) <= techo);
        }
      },
    ),
  );
  assert.ok(DURACION_ESCOMBROS_MS < DURACION_HUMO_MS);
});
