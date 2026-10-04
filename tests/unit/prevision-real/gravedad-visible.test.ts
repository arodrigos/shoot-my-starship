import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPrevisualizacion,
  PASOS_PREVISUALIZACION,
  PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS,
  superaPresupuestoComputo,
} from "@/sim/armas/previsualizacion";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { ALTURA_CANON_PX, alturaSuperficie, detenerseEnSuelo } from "@/sim/armas/resolver";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 2400;
const ALTO = 1400;
const ORIGEN_X = 300;
const GRAVEDAD = 1;
const DERIVA = 0;

// grav-vis-2: "la previsualización no pasa del 25% del vuelo estimado" es
// una cota RELATIVA a la duración real del vuelo, distinta de la cota fija
// PASOS_PREVISUALIZACION de pvr-2. Un tiro muy corto (ángulo cerrado,
// potencia baja, cae casi debajo del cañón) aterriza en muchos menos de
// PASOS_PREVISUALIZACION*4 pasos: si la cota fija sola decidiera, se vería
// el vuelo casi entero, no un cuarto.
test("grav-vis-2 (camino crítico): un tiro corto no previsualiza más del 25% de su propio vuelo real", () => {
  const alturaSuelo = 700;
  const mascara = crearMascaraPlana(ANCHO, ALTO, alturaSuelo);
  const anguloGrados = 70;
  const potencia = 8;

  const previsualizacion = calcularPrevisualizacion({
    mascara,
    gravedad: GRAVEDAD,
    deriva: DERIVA,
    ancho: ANCHO,
    alto: ALTO,
    origenX: ORIGEN_X,
    anguloGrados,
    potencia,
    comportamiento: { tipo: "impacto-simple" },
  });

  const origenY = alturaSuperficie(mascara, ORIGEN_X) ?? ALTO - 1;
  const rad = (anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(potencia);
  const inicial = crearProyectil(ORIGEN_X, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const real = simularVuelo(inicial, GRAVEDAD, DERIVA, detenerseEnSuelo(mascara, ANCHO, ALTO));

  assert.ok(real.pasos < PASOS_PREVISUALIZACION * 4, `este tiro no es corto de verdad (${real.pasos} pasos): ajustar el escenario`);
  assert.ok(
    previsualizacion.length - 1 <= Math.ceil(real.pasos * 0.25),
    `la previsualización mostró ${previsualizacion.length - 1} pasos de un vuelo real de ${real.pasos} -- más del 25%`,
  );
});

// grav-vis-2: un vuelo largo (potencia alta, ángulo raso) sigue acotado por
// la cota fija de siempre -- el 25% de un vuelo largo es, de sobra, mayor
// que PASOS_PREVISUALIZACION, así que mostrarla entera no delata nada.
test("grav-vis-2: un tiro largo sigue acotado por PASOS_PREVISUALIZACION, que ya cumple el 25% sin calcular el total", () => {
  const anchoAmplio = 20_000;
  const alturaSuelo = 1395;
  const mascara = crearMascaraPlana(anchoAmplio, ALTO, alturaSuelo);
  const origenY = 50;
  const anguloGrados = 5;
  const potencia = 99;
  const gravedadDebil = 0.1;

  const previsualizacion = calcularPrevisualizacion({
    mascara,
    gravedad: gravedadDebil,
    deriva: DERIVA,
    ancho: anchoAmplio,
    alto: ALTO,
    origenX: ORIGEN_X,
    origenY,
    anguloGrados,
    potencia,
    comportamiento: { tipo: "impacto-simple" },
  });

  const rad = (anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(potencia);
  const inicial = crearProyectil(ORIGEN_X, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const real = simularVuelo(inicial, gravedadDebil, DERIVA, detenerseEnSuelo(mascara, anchoAmplio, ALTO));

  assert.ok(real.pasos >= PASOS_PREVISUALIZACION * 4, `este tiro no es largo de verdad (${real.pasos} pasos): ajustar el escenario`);
  assert.equal(previsualizacion.length, PASOS_PREVISUALIZACION + 1);
});

// grav-vis-5: decisión pura de ocultar el preview por presupuesto de
// cómputo -- se prueba la DECISIÓN en aislado, con duraciones inyectadas,
// nunca con un cronómetro real dentro del test (issue #151: un test que
// dependiera de cuánto tarda de verdad esta máquina sería intermitente).
// El presupuesto de verdad (¿se agota alguna vez en el peor caso del
// diseño?) ya lo mide esp-8 (pvr-3) con duraciones reales y margen p95.
test("grav-vis-5: supera el presupuesto de cómputo exactamente por encima del umbral declarado, nunca por debajo ni igual", () => {
  assert.equal(superaPresupuestoComputo(0), false);
  assert.equal(superaPresupuestoComputo(PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS), false);
  assert.equal(superaPresupuestoComputo(PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS + 0.01), true);
  assert.equal(superaPresupuestoComputo(1000), true);
});
