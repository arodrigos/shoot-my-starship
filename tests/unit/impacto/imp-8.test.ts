import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { ALTURA_CANON_PX, detenerseEnSuelo, resolverDisparo } from "@/sim/armas/resolver";
import { crearProyectil, integrarPasoProyectil } from "@/sim/fisica/proyectil";
import { PASO_FIJO_MS } from "@/sim/tiempo";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

// imp-8: UN SOLO ORÁCULO DE TIRO. La cobertura de las 500 semillas
// ("en 500 semillas, el 100% de las colocaciones entregadas cumplen esa
// condición") es exactamente tests/unit/naves/nav-3.test.ts, reescrito en
// este mismo bloque sobre existeTiroViable -- no se repite aquí para no
// pagar dos veces el mismo coste (~40s) por la misma prueba. Este fichero
// aporta la otra mitad del criterio: demostrar con un escenario mínimo por
// qué la condición de parada privada por proximidad que tenía
// src/sim/balistica/busqueda.ts (borrado en este bloque) mentía.
const ANCHO = 3000;
const ALTO = 2000;
const ALTURA_SUELO = 1500;
const ORIGEN_X = 500;
const ANGULO_GRADOS = 55;
const POTENCIA = 70;
const TOLERANCIA_HEURISTICA_ANTIGUA_PX = 60;

test("imp-8: la vieja heurística de proximidad declara viable un tiro cuyo daño real es 0", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO);
  const armaBase = buscarArma("pepinazo-cortesia");
  const v = 300 + (POTENCIA / 100) * 1100;
  const rad = (ANGULO_GRADOS * Math.PI) / 180;
  const pasoS = PASO_FIJO_MS / 1000;

  // El ápice de la parábola real (vy cruza a >= 0): localmente plano, así
  // que un punto 45px justo por encima cae fuera del casco (22px) pero
  // dentro de los 60px que la heurística vieja consideraba "cerca".
  let apice = crearProyectil(ORIGEN_X, ALTURA_SUELO - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  while (apice.vy < 0) {
    apice = integrarPasoProyectil(apice, 1, 0, pasoS);
  }
  const objetivoX = apice.x;
  const objetivoY = apice.y - 45;

  // La heurística que ya no existe en el repositorio, reconstruida aquí SOLO
  // como referencia de lo que hacía mal: para en cuanto se acerca a 60px del
  // objetivo, sin comprobar solidez, casco, ni daño real -- exactamente la
  // condición de parada privada que imp-8 exige borrar de producción.
  let proyectil = crearProyectil(ORIGEN_X, ALTURA_SUELO - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const detenerseReal = detenerseEnSuelo(mascara, ANCHO, ALTO);
  let distanciaMinima = Infinity;
  while (!detenerseReal(proyectil)) {
    distanciaMinima = Math.min(distanciaMinima, Math.hypot(proyectil.x - objetivoX, proyectil.y - objetivoY));
    if (distanciaMinima <= TOLERANCIA_HEURISTICA_ANTIGUA_PX) break;
    proyectil = integrarPasoProyectil(proyectil, 1, 0, pasoS);
  }
  const viableSegunHeuristicaAntigua = distanciaMinima <= TOLERANCIA_HEURISTICA_ANTIGUA_PX;
  assert.equal(viableSegunHeuristicaAntigua, true, "el escenario debe replicar el falso positivo de la heurística vieja");

  // El oráculo real: mismo tiro, mismo mundo, resuelto por resolverDisparo
  // (vuelo real + parada real + catálogo real). El proyectil nunca se
  // detiene cerca del objetivo -- sigue de largo y aterriza a casi 1000px de
  // distancia, muy fuera del radio de daño del arma.
  const resultado = resolverDisparo({
    mascara,
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: armaBase,
    origenX: ORIGEN_X,
    anguloGrados: ANGULO_GRADOS,
    potencia: POTENCIA,
    objetivoX,
    objetivoY,
    ancho: ANCHO,
    alto: ALTO,
    naves: [
      { id: 0, x: ORIGEN_X, y: ALTURA_SUELO },
      { id: 1, x: objetivoX, y: objetivoY },
    ],
    tiradorId: 0,
  });

  assert.equal(resultado.danioObjetivo, 0, "el oráculo real debe reconocer que este tiro no causa ningún daño");
  assert.equal(resultado.puntosDeImpacto[0]?.impactoNave, undefined, "el vuelo real no debe rozar ningún casco en este escenario");
});
