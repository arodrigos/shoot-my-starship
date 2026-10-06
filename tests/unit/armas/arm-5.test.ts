import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import type { Arma } from "@/sim/armas/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const SUELO_Y = 900;

// catalogo-y-selector retiró la Andanada del catálogo; el motor de ráfaga y
// de dispersión sigue vivo y se prueba con armas de prueba derivadas del
// Pepinazo.
const ARMA_RAFAGA = { ...buscarArma("pepinazo-cortesia"), disparosSimultaneos: { cantidad: 3, aperturaGrados: 12 }, dispersionGrados: 3 };

test("arm-5: una ráfaga de 3 produce exactamente 3 proyectiles con la apertura angular declarada", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, SUELO_Y);
  const arma = ARMA_RAFAGA;
  assert.deepEqual(arma.disparosSimultaneos, { cantidad: 3, aperturaGrados: 12 });

  const resultado = resolverDisparo({
    mascara,
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(7),
    arma,
    origenX: 300,
    anguloGrados: 45,
    potencia: 70,
    objetivoX: 900,
    objetivoY: SUELO_Y,
    ancho: ANCHO,
    alto: ALTO,
  });

  assert.equal(resultado.puntosDeImpacto.length, 3, "la ráfaga debe producir exactamente 3 puntos de impacto");
  const xs = resultado.puntosDeImpacto.map((p) => p.x).sort((a, b) => a - b);
  // La apertura real (>0) se traduce en 3 puntos de caída distintos, nunca
  // los 3 en el mismo sitio -- si lo estuvieran, la apertura angular no se
  // estaría aplicando de verdad.
  assert.ok(xs[1] - xs[0] > 1, "las flechas caen todas en el mismo punto, la apertura angular no tiene efecto");
  assert.ok(xs[2] - xs[1] > 1, "las flechas caen todas en el mismo punto, la apertura angular no tiene efecto");
});

// arm-5: dispersión real medida sobre repeticiones -- 200 disparos por arma,
// cada uno con su propio EstadoAleatorio independiente (no se reutiliza el
// mismo tirador 200 veces con el mismo estado, que daría 200 copias
// idénticas). El orden se comprueba sobre la DESVIACIÓN TÍPICA MEDIDA del
// punto de caída, nunca sobre dispersionGrados directamente, para que el
// test no se valide a sí mismo.
const REPETICIONES = 200;

function desviacionTipicaDeCaida(arma: Arma): number {
  const xs: number[] = [];
  for (let i = 0; i < REPETICIONES; i++) {
    const mascara = crearMascaraPlana(ANCHO, ALTO, SUELO_Y);
    const resultado = resolverDisparo({
      mascara,
      gravedad: 1,
      deriva: 0,
      aleatorio: crearEstadoAleatorio(10_000 + i),
      arma,
      origenX: 400,
      // Ángulo bajo (no 45°, donde dR/dθ pasa por cero): el alcance es más
      // sensible a un mismo grado de dispersión angular cuanto más lejos de
      // 45° se dispara, así que la MEDIDA sobre 200 tiros separa mejor el
      // orden real entre 3° y 6° de dispersión.
      anguloGrados: 20,
      potencia: 90,
      objetivoX: 900,
      objetivoY: SUELO_Y,
      ancho: ANCHO,
      alto: ALTO,
    });
    // El punto CENTRAL del abanico (offset angular 0 en la ráfaga, o el
    // único punto si el arma no tiene ráfaga): aísla la dispersión pura del
    // desplazamiento fijo de apertura, que si no confundiría la medida de
    // la Andanada con un ángulo efectivo distinto al de las demás armas.
    xs.push(resultado.puntosDeImpacto[Math.floor(resultado.puntosDeImpacto.length / 2)].x);
  }
  const media = xs.reduce((total, x) => total + x, 0) / xs.length;
  const varianza = xs.reduce((total, x) => total + (x - media) ** 2, 0) / xs.length;
  return Math.sqrt(varianza);
}

test("arm-5: el orden de las armas por dispersión MEDIDA sobre 200 disparos coincide con el orden declarado", () => {
  // Orden declarado en el catálogo: pepinazo (0°) < andanada (3°) < petardo (6°).
  const desviacionPepinazo = desviacionTipicaDeCaida(buscarArma("pepinazo-cortesia"));
  const desviacionAndanada = desviacionTipicaDeCaida(ARMA_RAFAGA);
  const desviacionPetardo = desviacionTipicaDeCaida(buscarArma("petardo-de-feria"));

  console.log(
    `arm-5: desviación típica medida -- pepinazo(0°)=${desviacionPepinazo.toFixed(2)}px, andanada(3°)=${desviacionAndanada.toFixed(2)}px, petardo(6°)=${desviacionPetardo.toFixed(2)}px`,
  );

  assert.ok(
    desviacionPepinazo < desviacionAndanada,
    `pepinazo (0°) debería dispersar menos que andanada (3°): ${desviacionPepinazo} vs ${desviacionAndanada}`,
  );
  assert.ok(
    desviacionAndanada < desviacionPetardo,
    `andanada (3°) debería dispersar menos que petardo (6°): ${desviacionAndanada} vs ${desviacionPetardo}`,
  );
});
