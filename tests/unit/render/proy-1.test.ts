import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { puntosSilueta, hashSilueta, dimensionMayor } from "@/juego/proyectiles/geometriaProyectil";
import { MUNDO_ANCHO } from "@/juego/constantes";

// proy-1 dice "18px a escala de juego", que es pantalla, no la unidad en la
// que se genera la geometría. Con Phaser.Scale.FIT, el mundo de MUNDO_ANCHO
// de ancho se encoge al ancho real del lienzo -- a 360px (esp-4/proy-5, el
// viewport móvil mínimo del diseño) un proyectil de 22px de mundo (el valor
// de antes de la sexta devolución de este bloque) se veía como una mota de
// ~4px. Medir en unidades de mundo sin esta conversión es exactamente la
// forma en que este test pasó cinco veces seguidas sin demostrar nada.
const ANCHO_VIEWPORT_MINIMO_PX = 360;
const ESCALA_RENDER_MINIMA = ANCHO_VIEWPORT_MINIMO_PX / MUNDO_ANCHO;

test("proy-1: ningún proyectil es un punto -- toda arma dibuja 18px o más en su dimensión mayor, YA A ESCALA DE PANTALLA", () => {
  for (const arma of CATALOGO_ARMAS) {
    const dimensionMundo = dimensionMayor(puntosSilueta(arma));
    const dimensionPantalla = dimensionMundo * ESCALA_RENDER_MINIMA;
    assert.ok(
      dimensionPantalla >= 18,
      `${arma.id}: silueta de ${dimensionMundo.toFixed(1)}px de mundo = ${dimensionPantalla.toFixed(1)}px en pantalla a 360px de ancho, por debajo de los 18px que exige el brief`,
    );
  }
});

test("proy-1: las siluetas del catálogo son distinguibles entre sí (hash sin colisiones)", () => {
  const hashes = new Set<string>();
  for (const arma of CATALOGO_ARMAS) {
    const hash = hashSilueta(puntosSilueta(arma));
    assert.ok(!hashes.has(hash), `${arma.id}: su silueta coincide con la de otra arma ya vista (hash "${hash}")`);
    hashes.add(hash);
  }
  assert.equal(hashes.size, CATALOGO_ARMAS.length);
});
