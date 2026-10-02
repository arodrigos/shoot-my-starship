import { test } from "node:test";
import assert from "node:assert/strict";
import { configurarTamanoMundo, MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { calcularTamanoContenedorJuego } from "@/juego/layoutContenedor";
import { DIMENSION_MINIMA_PX } from "@/juego/proyectiles/geometriaProyectil";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

// Mundo histórico (dev, antes de este bloque): Phaser.Scale.FIT elige el
// menor de los dos cocientes contenedor/mundo para no desbordar ningún eje
// -- es la misma fórmula que ya usa main.ts, replicada aquí sin importarla
// porque es el "antes" con el que se compara, no el comportamiento actual.
const MUNDO_ANCHO_DEV = 1920;
const MUNDO_ALTO_DEV = 1080;
function escalaFit(anchoContenedor: number, altoContenedor: number, anchoMundo: number, altoMundo: number): number {
  return Math.min(anchoContenedor / anchoMundo, altoContenedor / altoMundo);
}

const VIEWPORT_360x640 = { width: 360, height: 640 };
const UMBRAL_ESCALA = 1.6;
const UMBRAL_PROYECTIL_PX = 12;

test("encuadre-movil-2: a 360x640 la nave se ve al menos 1.6x más grande que en dev", () => {
  const contenedor = calcularTamanoContenedorJuego(VIEWPORT_360x640.width, VIEWPORT_360x640.height);
  const escalaDev = escalaFit(contenedor.ancho, contenedor.alto, MUNDO_ANCHO_DEV, MUNDO_ALTO_DEV);

  configurarTamanoMundo(contenedor.ancho, contenedor.alto);
  // Tras configurarTamanoMundo el aspecto del mundo coincide exactamente con
  // el del contenedor, así que FIT no deja letterbox y la escala resultante
  // es la misma midiendo por ancho o por alto -- se comprueba por las dos
  // vías en vez de asumirlo.
  const escalaPorAncho = contenedor.ancho / MUNDO_ANCHO;
  const escalaPorAlto = contenedor.alto / MUNDO_ALTO;
  assert.ok(
    Math.abs(escalaPorAncho - escalaPorAlto) < 0.001,
    `escala por ancho (${escalaPorAncho}) y por alto (${escalaPorAlto}) deberían coincidir sin letterbox`,
  );

  const escalaNueva = escalaPorAncho;
  assert.ok(
    escalaNueva >= UMBRAL_ESCALA * escalaDev,
    `escala nueva ${escalaNueva} no llega a ${UMBRAL_ESCALA}x la escala de dev ${escalaDev}`,
  );

  const naveEnPantallaPx = escalaNueva * RADIO_CASCO_NAVE_PX;
  const naveEnPantallaPxDev = escalaDev * RADIO_CASCO_NAVE_PX;
  assert.ok(
    naveEnPantallaPx >= UMBRAL_ESCALA * naveEnPantallaPxDev,
    `nave en pantalla ${naveEnPantallaPx}px no llega a ${UMBRAL_ESCALA}x los ${naveEnPantallaPxDev}px de dev`,
  );

  const proyectilMinimoPx = escalaNueva * DIMENSION_MINIMA_PX;
  assert.ok(
    proyectilMinimoPx >= UMBRAL_PROYECTIL_PX,
    `el proyectil más pequeño mide ${proyectilMinimoPx}px de pantalla, por debajo del suelo de ${UMBRAL_PROYECTIL_PX}px`,
  );
});
