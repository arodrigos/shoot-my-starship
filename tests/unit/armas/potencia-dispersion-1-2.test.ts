import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { dispersionPorPotenciaGrados, DISPERSION_POTENCIA_MAXIMA_GRADOS } from "@/sim/balistica/dispersionPotencia";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

// Mundo ancho a propósito: a potencia alta (90%, ángulo 20°) el alcance
// balístico ronda los 1500px desde el origen -- con un mundo más estrecho
// el impacto se recorta contra el borde (detenerseEnSuelo) antes de que la
// dispersión termine de desplegarse, lo que INVIERTE el orden medido entre
// bandas (medido: con 1920px, la banda de 95% dispersaba menos que la de
// 70%, censurada por el borde).
const ANCHO = 3000;
const ALTO = 1080;
const SUELO_Y = 900;
const ARMA = buscarArma("pepinazo-cortesia"); // dispersionGrados propia = 0: toda la variación medida viene de potencia-dispersion.
const DISPAROS_POR_BANDA = 220; // 5 bandas * 220 = 1100 >= 1000 (potencia-dispersion-1).
const BANDAS_POTENCIA = [10, 30, 50, 70, 90];

function desviacionTipicaCaida(potencia: number): number {
  const xs: number[] = [];
  for (let i = 0; i < DISPAROS_POR_BANDA; i++) {
    const mascara = crearMascaraPlana(ANCHO, ALTO, SUELO_Y);
    const resultado = resolverDisparo({
      mascara,
      gravedad: 1,
      deriva: 0,
      aleatorio: crearEstadoAleatorio(50_000 + i),
      arma: ARMA,
      origenX: 400,
      // Ángulo bajo, lejos de 45° (donde dR/dθ pasa por cero): mismo motivo
      // que arm-5 -- separa mejor el orden entre bandas sobre el punto de
      // caída.
      anguloGrados: 20,
      potencia,
      objetivoX: 900,
      objetivoY: SUELO_Y,
      ancho: ANCHO,
      alto: ALTO,
      incluirDispersionPotencia: true,
    });
    xs.push(resultado.puntosDeImpacto[0].x);
  }
  const media = xs.reduce((total, x) => total + x, 0) / xs.length;
  const varianza = xs.reduce((total, x) => total + (x - media) ** 2, 0) / xs.length;
  return Math.sqrt(varianza);
}

test("potencia-dispersion-1: la amplitud de dispersión por potencia crece de forma monótona y es nula en potencia 0", () => {
  assert.equal(dispersionPorPotenciaGrados(0), 0);
  let anterior = 0;
  for (const potencia of [10, 30, 50, 70, 90, 100]) {
    const amplitud = dispersionPorPotenciaGrados(potencia);
    assert.ok(amplitud > anterior, `la amplitud a potencia ${potencia} (${amplitud}) no supera a la anterior (${anterior})`);
    anterior = amplitud;
  }
  assert.equal(dispersionPorPotenciaGrados(100), DISPERSION_POTENCIA_MAXIMA_GRADOS);
});

test("potencia-dispersion-1: la desviación típica MEDIDA del punto de caída crece de banda a banda de potencia (>=1000 disparos sembrados)", () => {
  const desviaciones = BANDAS_POTENCIA.map((potencia) => ({ potencia, desviacion: desviacionTipicaCaida(potencia) }));
  console.log(
    "potencia-dispersion-1: " + desviaciones.map(({ potencia, desviacion }) => `${potencia}%=${desviacion.toFixed(2)}px`).join(", "),
  );
  for (let i = 1; i < desviaciones.length; i++) {
    assert.ok(
      desviaciones[i].desviacion > desviaciones[i - 1].desviacion,
      `banda ${desviaciones[i].potencia}% (${desviaciones[i].desviacion.toFixed(2)}px) no dispersa más que la banda ` +
        `${desviaciones[i - 1].potencia}% (${desviaciones[i - 1].desviacion.toFixed(2)}px)`,
    );
  }
  // Banda baja (10%): la amplitud es (0.1)^2 * 6 = 0.06°, despreciable frente
  // a la banda alta -- se exige expresamente "nula o despreciable".
  assert.ok(desviaciones[0].desviacion < desviaciones[desviaciones.length - 1].desviacion / 5);
});

test("potencia-dispersion-2: el núcleo sigue determinista -- misma partida sembrada, mismo resultado bit a bit", () => {
  const mascaraA = crearMascaraPlana(ANCHO, ALTO, SUELO_Y);
  const mascaraB = crearMascaraPlana(ANCHO, ALTO, SUELO_Y);
  const parametros = {
    gravedad: 1,
    deriva: 0,
    arma: ARMA,
    origenX: 400,
    anguloGrados: 30,
    potencia: 95,
    objetivoX: 900,
    objetivoY: SUELO_Y,
    ancho: ANCHO,
    alto: ALTO,
    incluirDispersionPotencia: true,
  };
  const resultadoA = resolverDisparo({ mascara: mascaraA, aleatorio: crearEstadoAleatorio(777), ...parametros });
  const resultadoB = resolverDisparo({ mascara: mascaraB, aleatorio: crearEstadoAleatorio(777), ...parametros });
  assert.deepEqual(resultadoA.puntosDeImpacto, resultadoB.puntosDeImpacto);
  assert.deepEqual(resultadoA.aleatorio, resultadoB.aleatorio);
});
