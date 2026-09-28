import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import type { Planeta } from "@/sim/gravedad/planetas";

const ANCHO = 3000;
const ALTO = 1200;
const Y_LINEA_RECTA = 600;

// Sistema de 6 planetas alternados por encima/debajo de la línea de tiro
// horizontal: masa real de sobra para curvar cualquier arma que sí obedezca
// la gravedad, en el mismo escenario para las dos armas (comparación real,
// no contra un número inventado).
const PLANETAS: Planeta[] = Array.from({ length: 6 }, (_, i) => ({
  id: (i % 6) + 1,
  cx: 400 + i * 400,
  cy: Y_LINEA_RECTA + (i % 2 === 0 ? 180 : -180),
  radio: 100,
  densidad: 2,
  pixelesVivos: 1_500_000,
}));

function dispararRecto(armaId: string) {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  return resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: buscarArma(armaId),
    origenX: 200,
    origenY: Y_LINEA_RECTA + 26, // compensa ALTURA_CANON_PX para salir exacto en Y_LINEA_RECTA
    anguloGrados: 0,
    potencia: 60,
    objetivoX: 2900,
    objetivoY: Y_LINEA_RECTA,
    ancho: ANCHO,
    alto: ALTO,
    planetas: PLANETAS,
  });
}

test("arm-4: el Rayo Láser ignora la gravedad de un sistema de 6 planetas (desviación < 1px) mientras el arma base se desvía más de 50px", () => {
  const base = dispararRecto("pepinazo-cortesia");
  const laser = dispararRecto("rayo-laser");

  assert.equal(base.proyectilPerdido, false);
  assert.equal(laser.proyectilPerdido, false);

  const desviacionBase = Math.abs(base.puntosDeImpacto[0].y - Y_LINEA_RECTA);
  const desviacionLaser = Math.abs(laser.puntosDeImpacto[0].y - Y_LINEA_RECTA);

  assert.ok(desviacionLaser < 1, `el láser se desvía ${desviacionLaser}px, debería ser < 1px`);
  assert.ok(desviacionBase > 50, `el arma base se desvía ${desviacionBase}px, debería ser > 50px en el mismo sistema`);
});
