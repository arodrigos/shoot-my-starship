import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { avanzar } from "@/sim/partida/avanzar";
import { crearPartidaInicial } from "@/sim/partida/motor";
import { generarMascara } from "@/sim/terreno/generador";
import { MUNDO_LOTE, NAVE0_X, NAVE1_X } from "../utils/loteAleatorio";
import { radioEfectoDeArma } from "@/sim/partida/detonaciones";
import {
  DANIO_REFERENCIA_ESCALA_MAXIMA,
  RADIO_REFERENCIA_ESCALA_MAXIMA,
  escalaDeDanio,
  escalaPorRadio,
  planificarExplosion,
} from "@/juego/efectos/planExplosion";

// El terreno real se genera una vez: lo que varía por caso es la semilla del
// azar de la partida, el ángulo y la potencia.
const MASCARA = generarMascara(4242, MUNDO_LOTE.ancho, MUNDO_LOTE.alto);

// exp-2 (invariante 1): para toda arma y toda semilla, avanzar() declara una
// detonación por cada punto de impacto del disparo, en el mismo sitio, y el
// radio que declara es el radio real de efecto del arma.
test("exp-2: cada arma del catálogo declara una detonación por impacto, en su sitio y con su radio real", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...CATALOGO_ARMAS.map((arma) => arma.id)),
      fc.integer({ min: 1, max: 0x7fffffff }),
      fc.double({ min: 1, max: 179, noNaN: true }),
      fc.double({ min: 20, max: 100, noNaN: true }),
      (armaId, semilla, anguloGrados, potencia) => {
        const inicial = crearPartidaInicial(MUNDO_LOTE, MASCARA, [NAVE0_X, NAVE1_X], semilla);
        const { eventos, detonaciones } = avanzar(inicial, { arma: armaId, anguloGrados, potencia, objetivoId: 1 });
        const arma = CATALOGO_ARMAS.find((a) => a.id === armaId)!;

        // Los eventos "impacto" que no vienen de un punto de impacto son el
        // autodaño de Despedida, que cae sobre el propio casco en el origen.
        const impactos = eventos.filter((e) => e.tipo === "impacto");
        assert.ok(detonaciones.length <= impactos.length, "no hay más detonaciones que impactos");
        for (const detonacion of detonaciones) {
          assert.equal(detonacion.armaId, armaId);
          assert.equal(detonacion.radioEfectoU, radioEfectoDeArma(arma, MUNDO_LOTE.ancho, MUNDO_LOTE.alto));
          const evento = impactos.find((e) => e.tipo === "impacto" && Math.abs(e.x - detonacion.x) <= 1 && Math.abs(e.y - detonacion.y) <= 1);
          assert.ok(evento, `la detonación (${detonacion.x}, ${detonacion.y}) tiene su impacto a ≤ 1 u`);
        }
      },
    ),
    { numRuns: 200 },
  );
});

// exp-2 (invariante 2, escala): monótona con el radio de efecto y con el daño
// aplicado, y la onda acaba exactamente en el radio de efecto.
test("exp-2: la escala es monótona con el radio y el daño, y la onda termina en radioEfectoU", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 300, noNaN: true }),
      fc.double({ min: 0, max: 300, noNaN: true }),
      fc.double({ min: 0, max: 100, noNaN: true }),
      fc.double({ min: 0, max: 100, noNaN: true }),
      fc.constantFrom<"nave" | "planeta" | "vacio">("nave", "planeta", "vacio"),
      fc.boolean(),
      (r1, r2, d1, d2, sobre, movimientoReducido) => {
        const [radioBajo, radioAlto] = r1 <= r2 ? [r1, r2] : [r2, r1];
        const [danioBajo, danioAlto] = d1 <= d2 ? [d1, d2] : [d2, d1];
        assert.ok(escalaPorRadio(radioBajo) <= escalaPorRadio(radioAlto));
        assert.ok(escalaDeDanio(danioBajo) <= escalaDeDanio(danioAlto));

        const plan = (radioEfectoU: number, danioAplicado: number) =>
          planificarExplosion({
            detonacion: { x: 0, y: 0, armaId: "x", radioEfectoU, danioAplicado, sobre },
            cssPorUnidad: 0.32,
            movimientoReducido,
            particulasConcedibles: (pedidas) => pedidas,
            cantidadMaxEscombros: 16,
            cantidadMaxHumo: 10,
          });
        const menor = plan(radioBajo, danioBajo);
        const mayor = plan(radioAlto, danioAlto);
        assert.equal(menor.radioOnda, radioBajo);
        assert.equal(mayor.radioOnda, radioAlto);
        assert.ok(menor.escala <= mayor.escala);
        assert.ok(menor.radioDestello <= mayor.radioDestello + 1e-9);
        assert.ok(menor.escombros <= mayor.escombros && menor.humo <= mayor.humo);
      },
    ),
    { numRuns: 300 },
  );
});

// exp-4 (invariante 4): con movimiento reducido no hay partículas ni
// sacudida, pero el destello (≤ 150 ms) y el anillo (400 ms) siguen ahí.
test("exp-4: con movimiento reducido el plan no emite partículas ni sacudida y conserva destello y anillo", () => {
  fc.assert(
    fc.property(fc.double({ min: 0, max: 200, noNaN: true }), fc.double({ min: 0, max: 100, noNaN: true }), (radioEfectoU, danioAplicado) => {
      const plan = planificarExplosion({
        detonacion: { x: 0, y: 0, armaId: "x", radioEfectoU, danioAplicado, sobre: "nave" },
        cssPorUnidad: 0.32,
        movimientoReducido: true,
        particulasConcedibles: (pedidas) => pedidas,
        cantidadMaxEscombros: 16,
        cantidadMaxHumo: 10,
      });
      assert.equal(plan.escombros, 0);
      assert.equal(plan.humo, 0);
      assert.equal(plan.sacudida, false);
      assert.ok(plan.duracionDestelloMs <= 150);
      assert.equal(plan.duracionOndaMs, 400);
      assert.equal(plan.radioOnda, radioEfectoU);
    }),
  );
});

// exp-5 (legibilidad numérica a 360x640): el destello mide ≥ 8 px CSS y el
// trazo de la onda ≥ 2 px CSS con cualquier escala CSS realista.
test("exp-5: destello ≥ 8 px CSS y trazo ≥ 2 px CSS para cualquier relación CSS/mundo", () => {
  fc.assert(
    fc.property(fc.double({ min: 0.1, max: 2, noNaN: true }), fc.double({ min: 0, max: 100, noNaN: true }), (cssPorUnidad, danioAplicado) => {
      const plan = planificarExplosion({
        detonacion: { x: 0, y: 0, armaId: "x", radioEfectoU: 55, danioAplicado, sobre: "vacio" },
        cssPorUnidad,
        movimientoReducido: false,
        particulasConcedibles: (pedidas) => pedidas,
        cantidadMaxEscombros: 16,
        cantidadMaxHumo: 10,
      });
      assert.ok(plan.radioDestello * cssPorUnidad >= 8 - 1e-9);
      assert.ok(plan.trazoOnda * cssPorUnidad >= 2 - 1e-9);
    }),
  );
});

test("exp-5: las referencias de escala salen del catálogo vigente (la mayor llega a escala 1)", () => {
  assert.equal(escalaDeDanio(DANIO_REFERENCIA_ESCALA_MAXIMA), 1);
  assert.equal(escalaPorRadio(RADIO_REFERENCIA_ESCALA_MAXIMA), 1);
  const pepinazo = CATALOGO_ARMAS.find((a) => a.id === "pepinazo-cortesia")!;
  const despedida = CATALOGO_ARMAS.find((a) => a.id === "despedida")!;
  assert.equal(radioEfectoDeArma(pepinazo), 55);
  assert.equal(radioEfectoDeArma(despedida), 115);
});

// exp-1: el mismo arma (misma onda) sobre una nave con daño se ve más grande
// que sobre un planeta o el vacío, y más cuanto más daño, también con el
// Pepinazo, cuyo radio domina a escalaDeDanio.
test("exp-1: una detonación que daña a una nave tiene mayor escala que la misma sobre un planeta y no menos escombros", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 300, noNaN: true }),
      fc.double({ min: 0.1, max: 100, noNaN: true }),
      fc.double({ min: 0.1, max: 100, noNaN: true }),
      (radioEfectoU, d1, d2) => {
        const plan = (sobre: "nave" | "planeta", danioAplicado: number) =>
          planificarExplosion({
            detonacion: { x: 0, y: 0, armaId: "x", radioEfectoU, danioAplicado, sobre },
            cssPorUnidad: 0.32,
            movimientoReducido: false,
            particulasConcedibles: (pedidas) => pedidas,
            cantidadMaxEscombros: 16,
            cantidadMaxHumo: 10,
          });
        const [bajo, alto] = d1 <= d2 ? [d1, d2] : [d2, d1];
        assert.ok(plan("nave", bajo).escala > plan("planeta", 0).escala);
        assert.ok(plan("nave", bajo).escala <= plan("nave", alto).escala);
        assert.ok(plan("nave", bajo).escombros >= plan("planeta", 0).escombros);
      },
    ),
    { numRuns: 300 },
  );
});

test("el realce de nave no pide más partículas que el máximo del emisor", () => {
  const plan = planificarExplosion({
    detonacion: { x: 0, y: 0, armaId: "pepinazo", radioEfectoU: 200, danioAplicado: 1000, sobre: "nave" },
    cssPorUnidad: 1,
    movimientoReducido: false,
    cantidadMaxEscombros: 16,
    cantidadMaxHumo: 10,
    particulasConcedibles: (n: number) => n,
  } as Parameters<typeof planificarExplosion>[0]);
  assert.ok(plan.escala > 1);
  assert.equal(plan.escombros, 16);
  assert.equal(plan.humo, 10);
});
