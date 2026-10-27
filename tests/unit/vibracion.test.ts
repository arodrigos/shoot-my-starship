import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  INTERVALO_MINIMO_IMPACTO_MS,
  PATRONES_VIBRACION,
  decidirVibracion,
  motivoApagada,
  type ContextoVibracion,
  type TipoVibracion,
} from "@/juego/control/vibracion";
import { fijarVibracionActiva, leerPreferenciaVibracion, obtenerVibracion, reiniciarVibracion, vibrar } from "@/juego/control/vibracionStore";

const TIPOS: TipoVibracion[] = ["disparo", "impacto", "remate", "prueba"];
const arbTipo = fc.constantFrom(...TIPOS);
const arbCtx = fc.record({
  soportada: fc.boolean(),
  preferencia: fc.boolean(),
  movimientoReducido: fc.boolean(),
  documentoVisible: fc.boolean(),
  enMedicion: fc.boolean(),
  ultimoImpactoMs: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
});
const ctxLibre: ContextoVibracion = { soportada: true, preferencia: true, movimientoReducido: false, documentoVisible: true, enMedicion: false, ultimoImpactoMs: null };

test("contexto que lo impide: nunca hay patrón", () => {
  fc.assert(
    fc.property(arbCtx, arbTipo, fc.integer({ min: 0, max: 200000 }), (ctx, tipo, t) => {
      const impide = !ctx.soportada || !ctx.preferencia || ctx.movimientoReducido || !ctx.documentoVisible || (ctx.enMedicion && tipo !== "prueba");
      if (impide) assert.equal(decidirVibracion(ctx, tipo, t), null);
    }),
  );
});

test("si hay patrón, es exactamente el del tipo", () => {
  fc.assert(
    fc.property(arbCtx, arbTipo, fc.integer({ min: 0, max: 200000 }), (ctx, tipo, t) => {
      const r = decidirVibracion(ctx, tipo, t);
      if (r !== null) assert.deepEqual(r, PATRONES_VIBRACION[tipo]);
    }),
  );
});

test("patrones: no vacíos, longitud impar, enteros en [1,100], suma ≤ 200", () => {
  for (const tipo of TIPOS) {
    const p = PATRONES_VIBRACION[tipo];
    assert.ok(p.length > 0 && p.length % 2 === 1, tipo);
    assert.ok(p.every((n) => Number.isInteger(n) && n >= 1 && n <= 100), tipo);
    assert.ok(p.reduce((a, b) => a + b, 0) <= 200, tipo);
  }
});

test("patrones: disparo, impacto y remate distintos; formas y sumas", () => {
  const { disparo, impacto, remate } = PATRONES_VIBRACION;
  assert.notDeepEqual(disparo, impacto);
  assert.notDeepEqual(disparo, remate);
  assert.notDeepEqual(impacto, remate);
  assert.equal(disparo.length, 1);
  assert.ok(impacto.length >= 3 && remate.length >= 3);
  const suma = (p: readonly number[]) => p.reduce((a, b) => a + b, 0);
  assert.ok(suma(remate) > suma(impacto));
});

test("ritmo: los impactos aceptados distan al menos el intervalo; el remate pasa siempre", () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 0, max: 2000 }), { minLength: 1, maxLength: 40 }), (saltos) => {
      let t = 0;
      let ultimo: number | null = null;
      const aceptados: number[] = [];
      for (const s of saltos) {
        t += s;
        if (decidirVibracion({ ...ctxLibre, ultimoImpactoMs: ultimo }, "impacto", t) !== null) {
          aceptados.push(t);
          ultimo = t;
        }
        assert.notEqual(decidirVibracion({ ...ctxLibre, ultimoImpactoMs: ultimo }, "remate", t), null);
      }
      for (let i = 1; i < aceptados.length; i++) assert.ok(aceptados[i] - aceptados[i - 1] >= INTERVALO_MINIMO_IMPACTO_MS);
    }),
  );
});

test("motivoApagada: prioridad no-soportada > movimiento-reducido > preferencia", () => {
  assert.equal(motivoApagada({ soportada: false, movimientoReducido: true, preferencia: false }), "no-soportada");
  assert.equal(motivoApagada({ soportada: true, movimientoReducido: true, preferencia: false }), "movimiento-reducido");
  assert.equal(motivoApagada({ soportada: true, movimientoReducido: false, preferencia: false }), "preferencia");
  assert.equal(motivoApagada({ soportada: true, movimientoReducido: false, preferencia: true }), null);
});

test("preferencia: solo el valor exacto '0' apaga y nada lanza", () => {
  fc.assert(
    fc.property(fc.option(fc.string(), { nil: null }), (v) => {
      assert.equal(leerPreferenciaVibracion(() => v), v !== "0");
    }),
  );
  assert.equal(leerPreferenciaVibracion(() => { throw new Error("bloqueado"); }), true);
  for (const v of ["", "true", "0 ", "{basura"]) assert.equal(leerPreferenciaVibracion(() => v), true);
});

function crearProveedor(devuelve = true, lanza = false) {
  const llamadas: Array<number | readonly number[]> = [];
  return {
    llamadas,
    proveedor: {
      vibrate(p: number | readonly number[]) {
        llamadas.push(p);
        if (lanza) throw new Error("no");
        return devuelve;
      },
    },
  };
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => null, setItem: () => undefined };
});

test("store: una llamada por petición con el patrón del tipo, registrada en la instantánea", () => {
  const f = crearProveedor();
  reiniciarVibracion(f.proveedor, { tactil: true, movimientoReducido: false });
  assert.equal(vibrar("disparo"), true);
  assert.deepEqual(f.llamadas, [PATRONES_VIBRACION.disparo]);
  const s = obtenerVibracion();
  assert.equal(s.activa, true);
  assert.equal(s.llamadas.length, 1);
  assert.equal(s.llamadas[0].tipo, "disparo");
  assert.equal(s.llamadas[0].aceptada, true);
});

test("store: movimiento reducido, sin API o sin pantalla táctil no llaman a nada", () => {
  const f = crearProveedor();
  reiniciarVibracion(f.proveedor, { tactil: true, movimientoReducido: true });
  vibrar("remate");
  reiniciarVibracion(f.proveedor, { tactil: false });
  vibrar("remate");
  reiniciarVibracion(null, { tactil: true });
  assert.equal(vibrar("remate"), false);
  assert.equal(f.llamadas.length, 0);
  assert.equal(obtenerVibracion().motivoApagada, "no-soportada");
});

test("store: un rechazo o una excepción cuentan como descartada y no se propagan", () => {
  for (const f of [crearProveedor(false), crearProveedor(true, true)]) {
    reiniciarVibracion(f.proveedor, { tactil: true, movimientoReducido: false });
    assert.equal(vibrar("disparo"), false);
    const s = obtenerVibracion();
    assert.equal(s.descartadas, 1);
    assert.equal(s.llamadas[0].aceptada, false);
  }
});

test("store: el pulso de prueba sale solo al pasar de Off a On y se guarda la preferencia", () => {
  const f = crearProveedor();
  const guardado: string[] = [];
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => null, setItem: (_: string, v: string) => guardado.push(v) };
  reiniciarVibracion(f.proveedor, { tactil: true, movimientoReducido: false });
  fijarVibracionActiva(false);
  assert.equal(f.llamadas.length, 0);
  fijarVibracionActiva(true);
  assert.deepEqual(f.llamadas, [PATRONES_VIBRACION.prueba]);
  assert.deepEqual(guardado, ["0", "1"]);
});
