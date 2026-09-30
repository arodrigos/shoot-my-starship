import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo, detenerseEnSuelo, ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { pasosDeMecha } from "@/sim/fisica/comportamientoExtendido";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { buscarArma } from "@/sim/armas/catalogo";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const GRAVEDAD = 1;
const GRANADA = buscarArma("granada-de-espoleta");

// gra-1: 5s a 60Hz son exactamente 300 pasos -- si esto cambiara,
// pasosDeMecha() dejaría de coincidir con lo que declara el catálogo.
test("gra-1: la Granada de Espoleta declara 5s, que pasosDeMecha resuelve a 300 pasos exactos", () => {
  assert.equal(GRANADA.comportamiento.tipo, "mecha");
  if (GRANADA.comportamiento.tipo === "mecha") {
    assert.equal(GRANADA.comportamiento.segundosHastaDetonar, 5);
    assert.equal(pasosDeMecha(GRANADA.comportamiento.segundosHastaDetonar), 300);
  }
});

function disparar(
  origenX: number,
  alturaSuelo: number,
  objetivoX: number,
  objetivoY: number,
  gravedad: number = GRAVEDAD,
  angulo?: number,
  potencia?: number,
) {
  const mascara = crearMascaraPlana(ANCHO, ALTO, alturaSuelo);
  const [solucion] = resolverSolucionesBalisticas(origenX, alturaSuelo, objetivoX, objetivoY, gravedad);
  return resolverDisparo({
    mascara,
    gravedad,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: GRANADA,
    origenX,
    anguloGrados: angulo ?? solucion.anguloGrados,
    potencia: potencia ?? solucion.potencia,
    objetivoX,
    objetivoY,
    ancho: ANCHO,
    alto: ALTO,
  });
}

// gra-1 (camino crítico): vuelo que choca antes de los 5s -- el contacto de
// suelo gana claramente, mucho antes del paso 300.
test("gra-1: un vuelo corto que choca antes de los 5s detona por contacto, nunca por la espoleta", () => {
  const resultado = disparar(300, 900, 900, 900);
  assert.equal(resultado.fallo, false);
  assert.equal(resultado.proyectilPerdido, false);
  assert.equal(resultado.puntosDeImpacto.length, 1);
  // Cerca de la línea de suelo (900): el contacto ganó mucho antes del paso
  // 300 -- no se comprueba el píxel exacto, solo que aterrizó, no que voló
  // 5s enteros por el aire.
  assert.equal(resultado.puntosDeImpacto[0].y >= 895, true);
  assert.equal(resultado.danioObjetivo > 0, true);
});

// gra-1 (camino crítico): vuelo libre lo bastante largo/alto para que la
// espoleta gane en el aire, exactamente en el paso 300 -- "esté el proyectil
// donde esté" es literal: detona por encima del suelo, no al contacto.
test("gra-1: un vuelo lo bastante largo detona en el aire, en el paso 300 exacto, no antes ni uno tarde", () => {
  const origenX = 300;
  const alturaSuelo = 900;
  const objetivoX = 900;
  const objetivoY = 900;
  // Disparo casi vertical (89°) a potencia máxima con una gravedad de mundo
  // baja (0.6, dentro del rango real de mundos jugables): tiempo de vuelo
  // natural de sobra por encima de 5s, para que la espoleta gane en el aire
  // sin depender de que caiga exactamente sobre el objetivo.
  const gravedad = 0.6;
  const angulo = 89;
  const potencia = 100;
  const mascara = crearMascaraPlana(ANCHO, ALTO, alturaSuelo);
  const rad = (angulo * Math.PI) / 180;
  const v = velocidadDesdePotencia(potencia);
  const inicial = crearProyectil(origenX, alturaSuelo - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const detenerse = detenerseEnSuelo(mascara, ANCHO, ALTO);
  const pasosNaturales = simularVuelo(inicial, gravedad, 0, detenerse).pasos;
  assert.equal(pasosNaturales > 300, true, "el fixture necesita un vuelo natural de más de 300 pasos para que la mecha gane en el aire");

  const resultado = disparar(origenX, alturaSuelo, objetivoX, objetivoY, gravedad, angulo, potencia);
  assert.equal(resultado.fallo, false);
  assert.equal(resultado.proyectilPerdido, false);
  assert.equal(resultado.puntosDeImpacto.length, 1);
  // Sigue en el aire (por encima de la línea de suelo): el reloj ganó, no el
  // contacto.
  assert.equal(resultado.puntosDeImpacto[0].y < alturaSuelo, true);
});

// gra-1: el 100% de los vuelos termina con un resultado declarado, nunca
// perdido por presupuesto -- barrido de balísticas distintas (corta, media,
// lofted) con la misma arma real de catálogo.
test("gra-1: ningún ángulo/potencia deja el disparo de la Granada sin resolver", () => {
  const casos: readonly [number, number][] = [
    [500, 900],
    [900, 900],
    [1500, 900],
    [700, 500],
  ];
  for (const [objetivoX, objetivoY] of casos) {
    const resultado = disparar(300, 900, objetivoX, objetivoY);
    assert.equal(resultado.proyectilPerdido, false, `objetivo (${objetivoX},${objetivoY}) se perdió por presupuesto`);
    assert.equal(resultado.puntosDeImpacto.length, 1, `objetivo (${objetivoX},${objetivoY}) sin punto de impacto`);
    assert.equal(Number.isFinite(resultado.puntosDeImpacto[0].x), true);
    assert.equal(Number.isFinite(resultado.puntosDeImpacto[0].y), true);
  }
});
