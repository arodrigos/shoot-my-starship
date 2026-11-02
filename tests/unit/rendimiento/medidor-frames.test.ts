import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CAPACIDAD_FRAMES, MedidorFrames, UMBRAL_FRAME_LARGO_MS, percentil } from "@/juego/rendimiento/medidorFrames";

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

test("percentil: p0 da el mínimo, p1 el máximo y nunca se sale de la lista", () => {
  fc.assert(
    fc.property(fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 1, maxLength: 50 }), fc.double({ min: 0, max: 1, noNaN: true }), (valores, p) => {
      const r = percentil(valores, p);
      assert.ok(valores.includes(r));
    }),
  );
  assert.equal(percentil([5, 1, 3], 0), 1);
  assert.equal(percentil([5, 1, 3], 1), 5);
});

test("instantánea vacía: sin frames, p95 y max a 0", () => {
  const i = new MedidorFrames(() => 0).instantanea();
  assert.deepEqual({ frames: i.frames, framesLargos: i.framesLargos, p95: i.p95, max: i.max }, { frames: 0, framesLargos: 0, p95: 0, max: 0 });
});

test("un frame de exactamente 50 ms no es largo; uno de LoAF cuenta aunque rAF no lo viera", () => {
  const medidor = new MedidorFrames(() => 0);
  medidor.registrarFrame(UMBRAL_FRAME_LARGO_MS);
  assert.equal(medidor.instantanea().framesLargos, 0);
  medidor.registrarFrameLargoNativo();
  assert.equal(medidor.instantanea().framesLargos, 1);
});

test("las marcas guardan el índice absoluto del siguiente frame y no pasan de 200", () => {
  const medidor = new MedidorFrames(() => 0);
  for (let k = 0; k < CAPACIDAD_FRAMES + 10; k++) medidor.registrarFrame(16);
  medidor.marcar("salida");
  assert.equal(medidor.instantanea().marcas[0].frame, CAPACIDAD_FRAMES + 10);
  for (let k = 0; k < 250; k++) medidor.marcar(k === 249 ? "impacto" : "explosion");
  const marcas = medidor.instantanea().marcas;
  assert.equal(marcas.length, 200);
  assert.equal(marcas[0].nombre, "explosion", "la marca más vieja se descartó");
  assert.equal(marcas[199].nombre, "impacto");
});

test("suscribirFrames recibe cada frame con su instante hasta darse de baja", () => {
  let t = 100;
  const medidor = new MedidorFrames(() => t);
  const vistos: Array<[number, number]> = [];
  const baja = medidor.suscribirFrames((d, instante) => vistos.push([d, instante]));
  medidor.registrarFrame(16);
  t = 130;
  medidor.registrarFrame(30);
  baja();
  medidor.registrarFrame(99);
  assert.deepEqual(vistos, [
    [16, 100],
    [30, 130],
  ]);
});

test("suscribirIntervalosRaf da el intervalo entre marcas de rAF y la baja cancela el frame pendiente", () => {
  const medidor = new MedidorFrames(() => 0);
  const pendientes = new Map<number, (t: number) => void>();
  const cancelados: number[] = [];
  let siguienteId = 1;
  const pedir = (cb: (t: number) => void) => {
    pendientes.set(siguienteId, cb);
    return siguienteId++;
  };
  const disparar = (t: number) => {
    const [[id, cb]] = [...pendientes];
    pendientes.delete(id);
    cb(t);
  };
  const intervalos: Array<[number, number]> = [];
  const baja = medidor.suscribirIntervalosRaf((i, t) => intervalos.push([i, t]), pedir, (id) => cancelados.push(id));
  disparar(1000);
  disparar(1016);
  disparar(1182);
  assert.deepEqual(intervalos, [
    [16, 1016],
    [166, 1182],
  ]);
  const ultimoId = [...pendientes.keys()][0];
  baja();
  assert.deepEqual(cancelados, [ultimoId]);
  // Un rAF que ya estaba en cola cuando llegó la baja no notifica ni pide otro.
  disparar(1200);
  assert.equal(intervalos.length, 2);
  assert.equal(pendientes.size, 0);
});

test("observarFramesLargos no hace nada sin soporte de LoAF y cuenta cada entrada si lo hay", () => {
  const original = globalThis.PerformanceObserver;
  try {
    const sinSoporte = new MedidorFrames(() => 0);
    sinSoporte.observarFramesLargos()();
    assert.equal(sinSoporte.instantanea().framesLargos, 0);

    let retrollamada: ((lista: { getEntries(): unknown[] }) => void) | null = null;
    let desconectado = false;
    class ObservadorFalso {
      static supportedEntryTypes = ["long-animation-frame"];
      constructor(cb: (lista: { getEntries(): unknown[] }) => void) {
        retrollamada = cb;
      }
      observe(): void {}
      disconnect(): void {
        desconectado = true;
      }
    }
    (globalThis as unknown as { PerformanceObserver: unknown }).PerformanceObserver = ObservadorFalso;
    const medidor = new MedidorFrames(() => 0);
    const baja = medidor.observarFramesLargos();
    retrollamada!({ getEntries: () => [{}, {}, {}] });
    assert.equal(medidor.instantanea().framesLargos, 3);
    baja();
    assert.equal(desconectado, true);

    (globalThis as unknown as { PerformanceObserver: unknown }).PerformanceObserver = undefined;
    new MedidorFrames(() => 0).observarFramesLargos()();
  } finally {
    globalThis.PerformanceObserver = original;
  }
});
