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
