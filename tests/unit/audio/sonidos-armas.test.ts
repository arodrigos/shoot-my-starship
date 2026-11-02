import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { construirMuestras } from "@/juego/audio/zzfx";
import {
  SONIDO_DISPARO_POR_ARMA,
  SONIDO_IMPACTO_POR_SUPERFICIE,
  clavesSonidos,
  crearAleatorio,
  precalcularMuestras,
  superficieDeImpacto,
} from "@/juego/audio/sonidosArmas";

const constante = (): number => 0.5;

function iguales(a: Float32Array, b: Float32Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

test("snd3-1: cada arma del catálogo tiene un disparo propio y no hay dos arrays iguales", () => {
  const muestras = CATALOGO_ARMAS.map((arma) => {
    const parametros = SONIDO_DISPARO_POR_ARMA[arma.id];
    assert.ok(parametros, `falta el sonido de ${arma.id}`);
    return construirMuestras(parametros, constante);
  });
  for (let i = 0; i < muestras.length; i++) {
    for (let j = i + 1; j < muestras.length; j++) {
      assert.ok(!iguales(muestras[i], muestras[j]), `${CATALOGO_ARMAS[i].id} y ${CATALOGO_ARMAS[j].id} suenan igual`);
    }
  }
});

test("snd3-2: los cuatro impactos suenan distinto y superficieDeImpacto decide la superficie", () => {
  const sonidos = Object.values(SONIDO_IMPACTO_POR_SUPERFICIE).map((p) => construirMuestras(p, constante));
  assert.equal(sonidos.length, 4);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.ok(!iguales(sonidos[i], sonidos[j]));
  assert.equal(superficieDeImpacto({ detonacion: true }, 0), "planeta");
  assert.equal(superficieDeImpacto({ detonacion: true, impactoNave: 1 }, 0), "nave");
  assert.equal(superficieDeImpacto({ detonacion: true, impactoNave: 1 }, 2), "escudo");
  assert.equal(superficieDeImpacto({ detonacion: false, impactoNave: 1 }, 2), "rebote");
});

test("snd3-1: construirMuestras es determinista y acotada a [-1, 1] para cualquier parámetro", () => {
  const parametro = fc.double({ min: -50, max: 2000, noNaN: true });
  fc.assert(
    fc.property(fc.array(parametro, { minLength: 0, maxLength: 21 }), fc.double({ min: 0, max: 1, noNaN: true }), (parametros, azar) => {
      // Se acota la duración: un ataque/liberación enorme no es un sonido válido.
      const acotados = parametros.map((v, i) => (i >= 3 && i <= 5 ? Math.min(Math.abs(v), 0.3) : i === 16 || i === 18 ? Math.min(Math.abs(v), 0.1) : v));
      const a = construirMuestras(acotados, () => azar);
      const b = construirMuestras(acotados, () => azar);
      assert.ok(iguales(a, b));
      assert.ok(a.every((v) => Number.isFinite(v) && v >= -1 && v <= 1));
    }),
    { numRuns: 60 },
  );
});

// El coste real depende de la máquina, así que el test no compara contra
// 50 ms pelados (sería inestable, issue #151): fija el trabajo (muestras
// totales) que cabe en ese presupuesto y deja una cota de tiempo holgada
// solo para atrapar una regresión patológica.
const TOPE_MUESTRAS_TOTALES = 200_000;
const COTA_HOLGADA_MS = 300;

test("snd3-6: la tabla entera genera pocas muestras y se precalcula rápido", () => {
  precalcularMuestras();
  const inicio = performance.now();
  const mapa = precalcularMuestras();
  const ms = performance.now() - inicio;
  assert.equal(mapa.size, clavesSonidos().length);
  const total = [...mapa.values()].reduce((suma, m) => suma + m.length, 0);
  assert.ok(total <= TOPE_MUESTRAS_TOTALES, `${total} muestras`);
  assert.ok(ms <= COTA_HOLGADA_MS, `precalcular tardó ${ms.toFixed(1)} ms`);
});

test("crearAleatorio es reproducible y vive en [0, 1)", () => {
  const a = crearAleatorio(7);
  const b = crearAleatorio(7);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});
