import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  FACTOR_MOSCA,
  ID_ARMA_MOSCA,
  SEMIAPERTURA_TRAMO1_GRADOS,
  SEMIAPERTURA_TRAMO2_GRADOS,
  cortarPorLongitudPantalla,
  geometriaTrayectoria,
  longitudDeArco,
  tramoEntre,
} from "@/juego/mira/trayectoriaPantalla";

const pantalla = fc.record({ anchoCss: fc.integer({ min: 200, max: 3000 }), altoCss: fc.integer({ min: 200, max: 3000 }) });
const arma = fc.constantFrom("canon", "granada", ID_ARMA_MOSCA);

test("tra-1: L es el lado mayor y los radios son L/8 y L/4, con semiapertura2 = 5 × semiapertura1", () => {
  fc.assert(
    fc.property(pantalla, arma, (p, armaId) => {
      const g = geometriaTrayectoria({ ...p, armaId });
      assert.equal(g.L, Math.max(p.anchoCss, p.altoCss));
      assert.equal(g.radioTramo1Px, g.L / 8);
      assert.equal(g.radioTramo2Px, g.L / 4);
      assert.equal(g.semiapertura2, 5 * g.semiapertura1);
    }),
  );
});

test("tra-1: ±9° y ±45° salvo la mosca, que dobla", () => {
  fc.assert(
    fc.property(pantalla, arma, (p, armaId) => {
      const g = geometriaTrayectoria({ ...p, armaId });
      const f = armaId === ID_ARMA_MOSCA ? FACTOR_MOSCA : 1;
      assert.equal(g.semiapertura1, SEMIAPERTURA_TRAMO1_GRADOS * f);
      assert.equal(g.semiapertura2, SEMIAPERTURA_TRAMO2_GRADOS * f);
    }),
  );
});

test("tra-1: a 360x640 y a 1180x820 las longitudes son las del diseño", () => {
  const a = geometriaTrayectoria({ anchoCss: 360, altoCss: 640, armaId: "canon" });
  assert.deepEqual([a.L, a.radioTramo1Px, a.radioTramo2Px], [640, 80, 160]);
  const b = geometriaTrayectoria({ anchoCss: 1180, altoCss: 820, armaId: "canon" });
  assert.equal(b.L, 1180);
  assert.equal(Math.round(b.radioTramo1Px), 148);
});

test("tra-2: la geometría no depende de la potencia ni del zoom (no los recibe)", () => {
  assert.equal(geometriaTrayectoria.length, 1);
  const g1 = geometriaTrayectoria({ anchoCss: 360, altoCss: 640, armaId: "canon" });
  const g2 = geometriaTrayectoria({ anchoCss: 360, altoCss: 640, armaId: "canon" });
  assert.deepEqual(g1, g2);
});

const polilinea = fc.array(fc.record({ x: fc.double({ min: -1000, max: 1000, noNaN: true }), y: fc.double({ min: -1000, max: 1000, noNaN: true }) }), { minLength: 1, maxLength: 40 });

test("cortarPorLongitudPantalla: longitud ≤ pedida (+0,5 px) y es prefijo de la original", () => {
  fc.assert(
    fc.property(polilinea, fc.double({ min: 0, max: 3000, noNaN: true }), (puntos, longitud) => {
      const corte = cortarPorLongitudPantalla(puntos, longitud);
      assert.ok(longitudDeArco(corte) <= longitud + 0.5);
      // Todos los puntos salvo el último recortado coinciden con la original.
      for (let i = 0; i < corte.length - 1; i++) assert.deepEqual(corte[i], puntos[i]);
      // El último punto está sobre el segmento que lo originó.
      const k = corte.length - 1;
      if (k >= 1 && k < puntos.length) {
        const a = puntos[k - 1];
        const b = puntos[k];
        const c = corte[k];
        const largo = Math.hypot(b.x - a.x, b.y - a.y);
        assert.ok(Math.abs(Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y) - largo) < 1e-6);
      }
    }),
  );
});

test("cortarPorLongitudPantalla: una línea más corta que el límite se devuelve entera", () => {
  const p = [{ x: 0, y: 0 }, { x: 3, y: 4 }];
  assert.deepEqual(cortarPorLongitudPantalla(p, 100), p);
  const corte = cortarPorLongitudPantalla(p, 2.5);
  assert.ok(Math.abs(longitudDeArco(corte) - 2.5) < 1e-9);
});

test("tra-1: un borde del abanico ancho que choca antes del tramo 1 sigue teniendo dos puntos (mosca con la nave posada)", () => {
  const choqueTemprano = [{ x: 0, y: 0 }, { x: 10, y: 5 }];
  const borde = tramoEntre(choqueTemprano, 40, 80);
  assert.equal(borde.length, 2);
  assert.deepEqual(borde[0], { x: 10, y: 5 });
});

test("tra-1: tramoEntre siempre devuelve al menos dos puntos si hay trayectoria", () => {
  const punto = fc.record({ x: fc.integer({ min: -500, max: 500 }), y: fc.integer({ min: -500, max: 500 }) });
  fc.assert(
    fc.property(fc.array(punto, { minLength: 1, maxLength: 20 }), fc.integer({ min: 1, max: 300 }), fc.integer({ min: 1, max: 300 }), (puntos, r1, extra) => {
      const borde = tramoEntre(puntos, r1, r1 + extra);
      assert.ok(borde.length >= 2);
      assert.ok(longitudDeArco(borde) <= extra + 1e-6);
    }),
  );
});

import { areaPoligono, tirasTramo2 } from "@/juego/mira/trayectoriaPantalla";
import { calcularAbanicoPrevisualizacion, RAYOS_POR_LADO_TRAMO2 } from "@/sim/armas/previsualizacion";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

// Lo que se pinta, no solo que haya puntos: superficie de la franja ancha.
function areaFranja(rayos: readonly (readonly { x: number; y: number }[])[], r1: number, r2: number): number {
  return tirasTramo2(rayos, r1, r2).reduce((suma, tira) => suma + areaPoligono(tira), 0);
}

test("tra-1: con los dos bordes chocando antes de r1 la franja ancha sigue teniendo superficie", () => {
  const rayo = (grados: number, largo: number) => {
    const r = (grados * Math.PI) / 180;
    return [0, largo / 2, largo].map((d) => ({ x: Math.cos(r) * d, y: -Math.sin(r) * d }));
  };
  // Mosca: ±90° alrededor de 90°. Los bordes mueren a 20 px (< r1 = 80); los intermedios llegan a 160.
  const rayos = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180].map((g) => rayo(g, g === 0 || g === 180 ? 20 : 160));
  const soloBordes = areaFranja([rayos[0], rayos[8]], 80, 160);
  const conRayos = areaFranja(rayos, 80, 160);
  assert.equal(soloBordes, 0);
  // Media corona de 80 a 160 px menos los dos sectores extremos de 22,5°: bastante más de 10 000 px².
  assert.ok(conRayos > 10000, `área pintada ${conRayos}`);
});

test("tra-1: el abanico simulado de la mosca con la nave posada llena la franja ancha", () => {
  const mascara = crearMascaraPlana(2400, 1400, 1300);
  const base = { mascara, gravedad: 1, deriva: 0, ancho: 2400, alto: 1400, origenX: 1200, origenY: 1299, comportamiento: { tipo: "impacto-simple" } as const, anguloGrados: 90, potencia: 50, longitudMundoMax: 600 };
  const a = calcularAbanicoPrevisualizacion(base, 18, 90);
  assert.equal(a.tramo2.rayos.length, 2 * RAYOS_POR_LADO_TRAMO2 + 1);
  assert.equal(a.tramo2.rayos[RAYOS_POR_LADO_TRAMO2], a.centro);
  const aPantalla = (t: readonly { x: number; y: number }[]) => t.map((p) => ({ x: p.x, y: p.y }));
  const rayos = a.tramo2.rayos.map(aPantalla);
  const antes = (() => {
    const m = tramoEntre(rayos[0], 75, 150);
    const M = tramoEntre(rayos[rayos.length - 1], 75, 150);
    return areaPoligono([...m, ...[...M].reverse()]);
  })();
  const ahora = areaFranja(rayos, 75, 150);
  assert.ok(ahora > 5000, `área pintada ${ahora}`);
  assert.ok(ahora > antes * 3, `antes ${antes}, ahora ${ahora}`);
});
