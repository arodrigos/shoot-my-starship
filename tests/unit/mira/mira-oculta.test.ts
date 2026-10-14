import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { calcularPrevisualizacion, type ParametrosPrevisualizacion } from "@/sim/armas/previsualizacion";
import { REINTENTO_MIRA_OCULTA_MS, ocultarMira, tocaReintentarMira } from "@/juego/mira/miraOculta";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const MASCARA = crearMascaraPlana(2000, 1000, 700);

function parametros(anguloGrados: number, potencia: number, mascara = MASCARA): ParametrosPrevisualizacion {
  return {
    mascara,
    gravedad: 0.3,
    deriva: 0,
    ancho: 2000,
    alto: 1000,
    origenX: 300,
    anguloGrados,
    potencia,
    comportamiento: { tipo: "impacto-simple" },
  };
}

test("mir-1: oculta, ningún instante antes del margen pide cálculo, y pasado el margen sí", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 0, max: REINTENTO_MIRA_OCULTA_MS - 1 }), (desde, transcurrido) => {
      assert.equal(tocaReintentarMira(ocultarMira(desde, false), desde + transcurrido), false);
      assert.equal(tocaReintentarMira(ocultarMira(desde, false), desde + REINTENTO_MIRA_OCULTA_MS + transcurrido), true);
    }),
  );
});

test("mir-1: una mira forzada desde las pruebas no reintenta nunca sola", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 0, max: 10_000_000 }), (desde, transcurrido) => {
      assert.equal(tocaReintentarMira(ocultarMira(desde, true), desde + transcurrido), false);
    }),
  );
});

// El cálculo no guarda estado entre llamadas: lo que se muestra al reaparecer
// es, punto a punto, lo calculado desde cero para ese ajuste, pase lo que
// pase con los ajustes intermedios.
test("mir-1: la mira al reaparecer coincide con la calculada desde cero para el ajuste vigente", () => {
  fc.assert(
    fc.property(
      fc.array(fc.tuple(fc.integer({ min: 0, max: 180 }), fc.integer({ min: 5, max: 100 })), { minLength: 1, maxLength: 10 }),
      (ajustes) => {
        for (const [angulo, potencia] of ajustes) calcularPrevisualizacion(parametros(angulo, potencia));
        const [angulo, potencia] = ajustes[ajustes.length - 1];
        const reaparecida = calcularPrevisualizacion(parametros(angulo, potencia));
        const desdeCero = calcularPrevisualizacion(parametros(angulo, potencia, crearMascaraPlana(2000, 1000, 700)));
        assert.deepEqual(reaparecida, desdeCero);
      },
    ),
    { numRuns: 50 },
  );
});
