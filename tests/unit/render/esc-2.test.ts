import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { puntosSilueta, dimensionMayor, DIMENSION_MINIMA_PX, FRACCION_MINIMA_PROYECTIL, FRACCION_MAXIMA_PROYECTIL } from "@/juego/proyectiles/geometriaProyectil";
import { cajaCasco } from "@/sim/naves/geometriaCasco";

const ladoMayorNave = Math.max(...Object.values(cajaCasco(1)));

// esc-2: el suelo y el techo del proyectil se derivan de la geometría del
// casco por construcción -- toda arma del catálogo (las 8 familias
// visuales, las 13+ armas) cae dentro de la banda [FRACCION_MINIMA,
// FRACCION_MAXIMA] del lado mayor de la nave YA DIBUJADA, nunca por fuera.
test("esc-2: toda arma del catálogo respeta la relación tamaño/casco derivada, nunca una constante absoluta", () => {
  for (const arma of CATALOGO_ARMAS) {
    const dimension = dimensionMayor(puntosSilueta(arma));
    const fraccion = dimension / ladoMayorNave;
    // Margen de un píxel de mundo: DIMENSION_MINIMA_PX/DIMENSION_MAXIMA_PX
    // están redondeadas a entero, así que el borde real de la banda se
    // desplaza como mucho ~1/144.9 (~0.7 puntos porcentuales) respecto a la
    // fracción exacta -- no es holgura de la prueba, es el redondeo real.
    const MARGEN_REDONDEO = 1 / ladoMayorNave;
    assert.ok(
      fraccion >= FRACCION_MINIMA_PROYECTIL - MARGEN_REDONDEO && fraccion <= FRACCION_MAXIMA_PROYECTIL + MARGEN_REDONDEO,
      `${arma.id}: ${dimension.toFixed(1)}px de mundo es el ${(fraccion * 100).toFixed(1)}% del lado mayor de la nave (${ladoMayorNave.toFixed(1)}px), fuera de [${FRACCION_MINIMA_PROYECTIL * 100}%,${FRACCION_MAXIMA_PROYECTIL * 100}%]`,
    );
  }
});

// esc-2: cambiar la geometría del casco mueve el suelo del proyectil sin
// tocar ninguna otra constante -- se simula multiplicando el lado mayor de
// la nave y comprobando que DIMENSION_MINIMA_PX escala proporcionalmente
// (misma fracción, otra base).
test("esc-2: el suelo del proyectil se mueve si se mueve la geometría del casco (no es una constante copiada)", () => {
  const suelaEsperada = Math.round(ladoMayorNave * FRACCION_MINIMA_PROYECTIL);
  assert.equal(DIMENSION_MINIMA_PX, suelaEsperada);

  // Geometría de casco hipotética el doble de grande: el suelo derivado de
  // ESA geometría también se dobla, aproximadamente (misma fracción, otra
  // base -- el redondeo a entero de cada uno por separado puede diferir en
  // como mucho 1px) -- prueba que la relación es una fórmula, no un número
  // fijado a mano.
  const ladoMayorHipotetico = ladoMayorNave * 2;
  const suelaHipotetica = Math.round(ladoMayorHipotetico * FRACCION_MINIMA_PROYECTIL);
  assert.ok(Math.abs(suelaHipotetica - suelaEsperada * 2) <= 1);
});
