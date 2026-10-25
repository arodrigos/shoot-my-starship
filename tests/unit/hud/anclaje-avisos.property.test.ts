import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import type { RectCss } from "@/juego/camara/zonasOcupadas";
import { anclajePisaNaves, elegirAnclajeAvisos, rectanguloCapa, type ViewportCss } from "@/juego/hud/anclajeAvisos";

const RUNS = { numRuns: 300 };

const viewport = fc.record({ ancho: fc.integer({ min: 320, max: 1400 }), alto: fc.integer({ min: 560, max: 1400 }) });
const altoCapa = fc.integer({ min: 40, max: 160 });

// Consola pegada al borde inferior, como la del juego.
function consolaDe(v: ViewportCss, alto: number, ancho: number): RectCss {
  const a = Math.min(ancho, v.ancho);
  return { x: (v.ancho - a) / 2, y: v.alto - alto, ancho: a, alto };
}
const consolaArb = (v: ViewportCss) => fc.tuple(fc.integer({ min: 64, max: Math.floor(v.alto * 0.4) }), fc.integer({ min: 48, max: v.ancho })).map(([h, w]) => consolaDe(v, h, w));
const naveArb = (v: ViewportCss) =>
  fc.record({ x: fc.integer({ min: -50, max: v.ancho }), y: fc.integer({ min: -50, max: v.alto }), ancho: fc.integer({ min: 20, max: 120 }), alto: fc.integer({ min: 20, max: 140 }) });

const escenario = viewport.chain((v) =>
  fc.record({ v: fc.constant(v), alto: altoCapa, consola: consolaArb(v), naves: fc.array(naveArb(v), { maxLength: 4 }) }),
);

test("si algún anclaje no pisa ninguna nave, se elige uno que no pisa ninguna", () => {
  fc.assert(
    fc.property(escenario, ({ v, alto, consola, naves }) => {
      const arribaLibre = rectanguloCapa("arriba", consola, v, alto) !== null && !anclajePisaNaves("arriba", naves, consola, v, alto);
      const sobre = rectanguloCapa("sobre-consola", consola, v, alto);
      const sobreLibre = sobre !== null && !anclajePisaNaves("sobre-consola", naves, consola, v, alto);
      if (!arribaLibre && !sobreLibre) return;
      const elegido = elegirAnclajeAvisos(naves, consola, v, alto);
      assert.equal(anclajePisaNaves(elegido, naves, consola, v, alto), false);
    }),
    RUNS,
  );
});

test("es determinista y, ante empate, devuelve «arriba»", () => {
  fc.assert(
    fc.property(escenario, ({ v, alto, consola, naves }) => {
      assert.equal(elegirAnclajeAvisos(naves, consola, v, alto), elegirAnclajeAvisos([...naves], { ...consola }, { ...v }, alto));
    }),
    RUNS,
  );
  // Sin naves los dos anclajes están libres: empate.
  fc.assert(
    fc.property(viewport, altoCapa, (v, alto) => assert.equal(elegirAnclajeAvisos([], consolaDe(v, 200, 340), v, alto), "arriba")),
    RUNS,
  );
});

test("la capa, en cualquier anclaje, queda dentro del viewport y no interseca la consola", () => {
  fc.assert(
    fc.property(escenario, ({ v, alto, consola }) => {
      for (const anclaje of ["arriba", "sobre-consola"] as const) {
        const r = rectanguloCapa(anclaje, consola, v, alto);
        if (r === null) continue;
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.ancho <= v.ancho && r.y + r.alto <= v.alto, `${anclaje} dentro del viewport`);
        // «arriba» solo se garantiza libre de la consola mientras quepa encima de ella.
        if (anclaje === "sobre-consola" || r.y + r.alto <= consola.y) {
          assert.ok(r.y + r.alto <= consola.y, `${anclaje} no pisa la consola`);
        }
      }
    }),
    RUNS,
  );
});
