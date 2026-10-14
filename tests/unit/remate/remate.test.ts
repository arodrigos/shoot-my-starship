import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { permiteMovimientoCamara } from "@/juego/efectos/movimientoCamara";
import {
  ControladorRemate,
  LIMITE_SEGURIDAD_REMATE_MS,
  centroDeZoom,
  decidirRemate,
  duracionPlan,
  maximoDestellosPorSegundo,
  planRemate,
  ZOOM_REMATE,
} from "@/juego/efectos/remate";

test("rem-3: permiteMovimientoCamara es true solo con sacudida y sin movimiento reducido", () => {
  fc.assert(
    fc.property(fc.boolean(), fc.boolean(), (sacudida, reducido) => {
      assert.equal(permiteMovimientoCamara(sacudida, reducido), sacudida && !reducido);
    }),
  );
});

test("rem-3: decidirRemate es pura y respeta el modo", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 4 }), fc.boolean(), fc.boolean(), (navesDestruidas, finDePartida, permiteMovimiento) => {
      const modo = decidirRemate({ navesDestruidas, finDePartida, permiteMovimiento });
      if (navesDestruidas === 0) assert.equal(modo, "ninguno");
      else assert.equal(modo, permiteMovimiento ? "completo" : "destello");
    }),
  );
});

test("rem-1: el plan completo va en orden y dura <= 800 ms; el destello <= 150 ms", () => {
  const completo = planRemate("completo");
  assert.deepEqual(completo.map((f) => f.nombre), ["destello", "pausa", "acercamiento", "sosten", "vuelta"]);
  assert.ok(duracionPlan(completo) <= 800);
  assert.equal(completo[1].finMs - completo[1].inicioMs, 200);
  assert.ok(duracionPlan(planRemate("destello")) <= 150);
});

test("rem-2: el encuadre del zoom queda dentro del mundo y la vuelta restaura el original", () => {
  fc.assert(
    fc.property(
      fc.double({ min: -50, max: 1300, noNaN: true }),
      fc.double({ min: -50, max: 800, noNaN: true }),
      fc.double({ min: 200, max: 1200, noNaN: true }),
      fc.double({ min: 200, max: 900, noNaN: true }),
      (x, y, ancho, alto) => {
        const c = centroDeZoom({ x, y }, ancho, alto, ZOOM_REMATE);
        assert.ok(c.x - ancho / (2 * ZOOM_REMATE) >= -1e-9 && c.x + ancho / (2 * ZOOM_REMATE) <= ancho + 1e-9);
        assert.ok(c.y - alto / (2 * ZOOM_REMATE) >= -1e-9 && c.y + alto / (2 * ZOOM_REMATE) <= alto + 1e-9);
        const original = { x: ancho / 2, y: alto / 2 };
        const ctl = new ControladorRemate("completo", original, { x, y }, ancho, alto);
        const final = ctl.avanzar(10_000);
        assert.equal(final.terminado, true);
        assert.equal(final.zoom, 1);
        assert.deepEqual(final.centro, original);
      },
    ),
  );
});

test("rem-1: la pausa congela, el zoom sube y baja, y el fin llega antes del límite", () => {
  const ctl = new ControladorRemate("completo", { x: 600, y: 400 }, { x: 100, y: 100 }, 1200, 800);
  const vistas: string[] = [];
  let t = 0;
  let ultimo = ctl.avanzar(0);
  while (!ultimo.terminado) {
    t += 16;
    ultimo = ctl.avanzar(16);
    if (ultimo.congelado) vistas.push("congelado");
    assert.ok(t <= LIMITE_SEGURIDAD_REMATE_MS + 16);
  }
  assert.ok(vistas.length > 0);
  assert.ok(t <= 800 + 16);
});

test("rem-7: aunque el plan se alargara, el límite de seguridad fuerza el fin", () => {
  const ctl = new ControladorRemate("completo", { x: 600, y: 400 }, { x: 300, y: 300 }, 1200, 800);
  assert.equal(ctl.fotograma(LIMITE_SEGURIDAD_REMATE_MS).terminado, true);
});

test("rem-3: el destello solo hay en modo destello, sin zoom ni pausa", () => {
  const ctl = new ControladorRemate("destello", { x: 600, y: 400 }, { x: 300, y: 300 }, 1200, 800);
  for (let t = 0; t < 150; t += 10) {
    const f = ctl.fotograma(t);
    assert.equal(f.zoom, 1);
    assert.equal(f.congelado, false);
    assert.ok(f.alfaDestello <= 0.5);
  }
  assert.equal(ctl.fotograma(150).terminado, true);
});

test("rem-6: un registro con un destello por remate no pasa de 3 por segundo", () => {
  assert.equal(maximoDestellosPorSegundo([0, 1000, 2000]), 1);
  assert.equal(maximoDestellosPorSegundo([0, 100, 200]), 3);
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 0, max: 100_000 }), { maxLength: 20 }), (tiempos) => {
      const espaciados = tiempos.map((_, i) => i * 800);
      assert.ok(maximoDestellosPorSegundo(espaciados) <= 2);
    }),
  );
});
