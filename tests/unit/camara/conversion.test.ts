import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { mundoAPantallaCss, pantallaCssAMundo, type EscenaConCamara } from "@/juego/camara/conversion";

function escena(zoom: number, scrollX: number, scrollY: number, rect: { left: number; top: number; width: number; height: number }): EscenaConCamara {
  return { cameras: { main: { width: 1000, height: 600, zoom, scrollX, scrollY } }, game: { canvas: { getBoundingClientRect: () => rect } } };
}

test("con zoom 1 y sin scroll el mundo llena el lienzo y se respeta su posición en la página", () => {
  const e = escena(1, 0, 0, { left: 20, top: 10, width: 500, height: 300 });
  assert.deepEqual(mundoAPantallaCss(e, { x: 0, y: 0 }), { x: 20, y: 10 });
  assert.deepEqual(mundoAPantallaCss(e, { x: 1000, y: 600 }), { x: 520, y: 310 });
});

test("con zoom 2 centrado, el centro del mundo sigue en el centro y los extremos salen de pantalla", () => {
  const e = escena(2, 0, 0, { left: 0, top: 0, width: 1000, height: 600 });
  assert.deepEqual(mundoAPantallaCss(e, { x: 500, y: 300 }), { x: 500, y: 300 });
  assert.deepEqual(mundoAPantallaCss(e, { x: 250, y: 150 }), { x: 0, y: 0 });
});

test("pantallaCssAMundo es la inversa de mundoAPantallaCss para cualquier cámara", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0.5, max: 3, noNaN: true }),
      fc.double({ min: -300, max: 300, noNaN: true }),
      fc.double({ min: -300, max: 300, noNaN: true }),
      fc.double({ min: 0, max: 1000, noNaN: true }),
      fc.double({ min: 0, max: 600, noNaN: true }),
      (zoom, sx, sy, x, y) => {
        const e = escena(zoom, sx, sy, { left: 13, top: 7, width: 360, height: 216 });
        const vuelta = pantallaCssAMundo(e, mundoAPantallaCss(e, { x, y }));
        assert.ok(Math.abs(vuelta.x - x) < 1e-6 && Math.abs(vuelta.y - y) < 1e-6);
      },
    ),
    { numRuns: 200 },
  );
});
