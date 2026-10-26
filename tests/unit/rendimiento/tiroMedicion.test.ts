import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { MedidorFrames } from "@/juego/rendimiento/medidorFrames";
import { ANGULOS_MEDICION, POTENCIAS_MEDICION, elegirTiroMedicion, type ResultadoTiroMedicion } from "@/juego/rendimiento/tiroMedicion";

const BUENO: ResultadoTiroMedicion = { proyectilPerdido: false, fallo: false, detonaciones: 1, danioObjetivo: 10, danioPropio: 0, autoimpacto: false };

test("md-2: nunca devuelve un tiro que se pierde, falla, no detona o se hace daño", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 2 ** 20 }), (semilla) => {
      const simular = (a: number, p: number): ResultadoTiroMedicion => {
        const h = (Math.imul(a + 1, 2654435761) ^ Math.imul(p + semilla, 40503)) >>> 0;
        return { proyectilPerdido: h % 3 === 0, fallo: h % 7 === 0, detonaciones: h % 5, danioObjetivo: h % 90, danioPropio: h % 11 === 0 ? 5 : 0, autoimpacto: h % 13 === 0 };
      };
      const tiro = elegirTiroMedicion(simular, 60);
      if (tiro === null) return true;
      const r = simular(tiro.anguloGrados, tiro.potencia);
      return !r.proyectilPerdido && !r.fallo && r.detonaciones > 0 && !r.autoimpacto && r.danioPropio === 0 && r.danioObjetivo < 60;
    }),
  );
});

test("md-2: el tiro del recorrido sale de la rejilla de ángulos y potencias del simulador", () => {
  const tiro = elegirTiroMedicion(() => BUENO, 100);
  assert.ok(tiro);
  assert.ok(ANGULOS_MEDICION.includes(tiro.anguloGrados));
  assert.ok(POTENCIAS_MEDICION.includes(tiro.potencia));
});

test("md-2: si el único tiro que detona mata al rival no se elige", () => {
  assert.equal(elegirTiroMedicion(() => ({ ...BUENO, danioObjetivo: 100 }), 100), null);
});

test("md-2: entre los tiros válidos elige el de menos daño", () => {
  const tiro = elegirTiroMedicion((a, p) => ({ ...BUENO, danioObjetivo: a === 85 && p === 70 ? 1 : 50 }), 100);
  assert.deepEqual(tiro, { anguloGrados: 85, potencia: 70 });
});

test("md-3: el intervalo sale de la marca de tiempo del rAF, no del delta de Phaser", () => {
  const medidor = new MedidorFrames();
  let cb: ((t: number) => void) | null = null;
  const pedir = (f: (t: number) => void): number => {
    cb = f;
    return 1;
  };
  const vistos: number[] = [];
  const baja = medidor.suscribirIntervalosRaf((d) => vistos.push(d), pedir, () => undefined);
  // Phaser suaviza: ve 16,7 ms aunque el tercer frame tardó 166 ms de verdad.
  for (const t of [0, 16.7, 33.4, 199.4, 216.1]) {
    medidor.registrarFrame(16.7);
    cb!(t);
  }
  baja();
  assert.deepEqual(vistos.map((d) => Math.round(d * 10) / 10), [16.7, 16.7, 166, 16.7]);
  assert.equal(Math.max(...medidor.instantanea().deltas.map((f) => f.delta)), 16.7);
});

test("md-3: al darse de baja no pide más frames", () => {
  const medidor = new MedidorFrames();
  let pedidos = 0;
  let cb: ((t: number) => void) | null = null;
  const baja = medidor.suscribirIntervalosRaf(() => undefined, (f) => { pedidos++; cb = f; return pedidos; }, () => undefined);
  cb!(0);
  baja();
  cb!(16);
  assert.equal(pedidos, 2);
});
