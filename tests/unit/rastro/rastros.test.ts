import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  ESTADO_RASTROS_VACIO,
  GUION_RASTRO_U,
  HUECO_RASTRO_U,
  MAXIMO_PUNTOS_RASTRO,
  borrarRastro,
  diezmarTrayectoria,
  rastroVisible,
  registrarRastro,
  segmentosDiscontinuos,
  type PuntoRastro,
} from "@/juego/rastro/rastros";

const puntos = fc.array(fc.record({ x: fc.integer({ min: -2000, max: 4000 }), y: fc.integer({ min: -2000, max: 4000 }) }), { minLength: 1, maxLength: 600 });

test("ras-1: diezmarTrayectoria devuelve como mucho 64 puntos, conserva el primero y el último y todos son de la original", () => {
  fc.assert(
    fc.property(puntos, (trayectoria) => {
      const r = diezmarTrayectoria(trayectoria);
      assert.ok(r.length <= MAXIMO_PUNTOS_RASTRO);
      assert.equal(r[0], trayectoria[0]);
      assert.equal(r[r.length - 1], trayectoria[trayectoria.length - 1]);
      for (const p of r) assert.ok(trayectoria.includes(p));
    }),
  );
});

test("ras-2: tras cualquier secuencia de disparos solo hay un rastro, el del último asiento", () => {
  fc.assert(
    fc.property(fc.array(fc.record({ asiento: fc.integer({ min: 0, max: 3 }), tray: puntos }), { minLength: 1, maxLength: 12 }), (disparos) => {
      let estado = ESTADO_RASTROS_VACIO;
      for (const d of disparos) estado = registrarRastro(d.asiento, d.tray, null);
      const ultimo = disparos[disparos.length - 1];
      assert.equal(estado.ultimo?.asiento, ultimo.asiento);
      assert.equal(estado.ultimo?.puntos[0], ultimo.tray[0]);
    }),
  );
});

test("ras-4: rastroVisible es null con el interruptor apagado o sin disparos; si no, el único rastro", () => {
  fc.assert(
    fc.property(fc.boolean(), fc.option(puntos, { nil: undefined }), (activo, tray) => {
      const estado = tray === undefined ? ESTADO_RASTROS_VACIO : registrarRastro(1, tray, null);
      const visible = rastroVisible(estado, activo);
      if (!activo || tray === undefined) assert.equal(visible, null);
      else assert.equal(visible, estado.ultimo);
    }),
  );
  assert.equal(borrarRastro().ultimo, null);
});

test("ras-3: los segmentos son a guiones: ninguno pasa del largo del guion y cada hueco entre rectas es el del patrón", () => {
  fc.assert(
    fc.property(puntos, (tray) => {
      const segs = segmentosDiscontinuos(tray as readonly PuntoRastro[]);
      for (const s of segs) assert.ok(Math.hypot(s.hasta.x - s.desde.x, s.hasta.y - s.desde.y) <= GUION_RASTRO_U + 1e-6);
    }),
  );
  const recta = segmentosDiscontinuos([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  assert.equal(recta.length, Math.ceil(100 / (GUION_RASTRO_U + HUECO_RASTRO_U)));
  assert.ok(Math.abs(recta[1].desde.x - (GUION_RASTRO_U + HUECO_RASTRO_U)) < 1e-9);
});
