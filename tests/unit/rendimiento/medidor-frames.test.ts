import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CAPACIDAD_FRAMES, MedidorFrames, percentil } from "@/juego/rendimiento/medidorFrames";

test("par-4: el medidor guarda como mucho 600 frames y calcula p95 y max", () => {
  fc.assert(
    fc.property(fc.array(fc.double({ min: 0, max: 500, noNaN: true }), { minLength: 1, maxLength: 900 }), (deltas) => {
      const medidor = new MedidorFrames(() => 0);
      deltas.forEach((d) => medidor.registrarFrame(d));
      const i = medidor.instantanea();
      const ultimos = deltas.slice(-CAPACIDAD_FRAMES);
      assert.equal(i.frames, deltas.length);
      assert.equal(i.deltas.length, ultimos.length);
      assert.equal(i.max, Math.max(...ultimos));
      assert.ok(i.p95 <= i.max && i.p95 >= Math.min(...ultimos));
    }),
  );
});

test("par-4: cuenta los frames de más de 50 ms y registra las marcas en orden", () => {
  let t = 0;
  const medidor = new MedidorFrames(() => t);
  [16, 17, 120, 16].forEach((d) => {
    t += d;
    medidor.registrarFrame(d);
  });
  medidor.marcar("impacto");
  t += 16;
  medidor.registrarFrame(16);
  medidor.marcar("explosion");
  const i = medidor.instantanea();
  assert.equal(i.framesLargos, 1);
  assert.deepEqual(i.marcas.map((m) => m.nombre), ["impacto", "explosion"]);
  // El frame registrado en el mismo instante que la marca entra en la ventana.
  assert.deepEqual(medidor.deltasEntre(i.marcas[0].t, i.marcas[1].t), [16, 16]);
});

test("percentil de una lista vacía es 0", () => {
  assert.equal(percentil([], 0.95), 0);
});
