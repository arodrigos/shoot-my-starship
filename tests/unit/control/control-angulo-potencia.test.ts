import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANGULO_MAXIMO_GRADOS,
  ANGULO_MINIMO_GRADOS,
  POTENCIA_MAXIMA,
  POTENCIA_MINIMA,
  anguloDesdeFraccionControl,
  potenciaConPasoFino,
  potenciaDesdeFraccionControl,
  sanearAjusteNumericoGuardado,
} from "@/juego/control/apuntado";

// ctl-2: recorrer el control de ángulo de un extremo físico al otro (fracción
// 0 a 1) en un único gesto debe cubrir el rango entero -- es el giro de 2° a
// 178° que pidió Adrián, resuelto por construcción (mapeo absoluto, sin
// ganancia ni estado de inicio).
test("ctl-2: la fracción 0 del control de ángulo da el mínimo y la fracción 1 da el máximo", () => {
  assert.equal(anguloDesdeFraccionControl(0), ANGULO_MINIMO_GRADOS);
  assert.equal(anguloDesdeFraccionControl(1), ANGULO_MAXIMO_GRADOS);
});

test("ctl-1: anguloDesdeFraccionControl y potenciaDesdeFraccionControl son funciones de un solo eje", () => {
  // Ninguna de las dos funciones recibe ni puede tocar el eje contrario:
  // la independencia de los dos controles es estructural, no un efecto
  // secundario evitado a mano.
  assert.equal(anguloDesdeFraccionControl.length, 1);
  assert.equal(potenciaDesdeFraccionControl.length, 1);
});

test("control-angulo-potencia: la fracción se satura fuera de [0,1] en vez de extrapolar", () => {
  assert.equal(anguloDesdeFraccionControl(-5), ANGULO_MINIMO_GRADOS);
  assert.equal(anguloDesdeFraccionControl(5), ANGULO_MAXIMO_GRADOS);
  assert.equal(potenciaDesdeFraccionControl(-5), POTENCIA_MINIMA);
  assert.equal(potenciaDesdeFraccionControl(5), POTENCIA_MAXIMA);
});

test("control-angulo-potencia: potenciaConPasoFino ajusta de una unidad entera y satura en el rango", () => {
  assert.equal(potenciaConPasoFino(50, 1), 51);
  assert.equal(potenciaConPasoFino(50, -1), 49);
  assert.equal(potenciaConPasoFino(POTENCIA_MAXIMA, 1), POTENCIA_MAXIMA);
  assert.equal(potenciaConPasoFino(POTENCIA_MINIMA, -1), POTENCIA_MINIMA);
});

// ctl-6: un valor corrupto en localStorage nunca debe romper el arranque --
// se satura a rango si es numéricamente válido, o se descarta (null, para
// que el store caiga al valor por defecto) si no lo es.
test("ctl-6: sanearAjusteNumericoGuardado satura los valores numéricos fuera de rango", () => {
  const saneado = sanearAjusteNumericoGuardado({ anguloGrados: 1e9, potencia: -1e9 });
  assert.deepEqual(saneado, { anguloGrados: ANGULO_MAXIMO_GRADOS, potencia: POTENCIA_MINIMA });
});

test("ctl-6: sanearAjusteNumericoGuardado rechaza NaN, tipos equivocados y valores no-objeto", () => {
  assert.equal(sanearAjusteNumericoGuardado({ anguloGrados: Number.NaN, potencia: 50 }), null);
  assert.equal(sanearAjusteNumericoGuardado({ anguloGrados: "45", potencia: 50 }), null);
  assert.equal(sanearAjusteNumericoGuardado(null), null);
  assert.equal(sanearAjusteNumericoGuardado("no es un objeto"), null);
  assert.equal(sanearAjusteNumericoGuardado(undefined), null);
});
