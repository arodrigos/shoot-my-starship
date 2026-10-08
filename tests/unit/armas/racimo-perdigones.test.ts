import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { buscarArma } from "@/sim/armas/catalogo";
import {
  ALTURA_CANON_PX,
  DANIO_MAXIMO_RACIMO_COMBINADO,
  RADIO_SUBMUNICION,
  alturaSuperficie,
  detenerseEnSuelo,
  limitarDanioCombinado,
  resolverDisparo,
} from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { crearMascaraVacia } from "@/sim/terreno/mascara";

const ANCHO = 2000;
const ALTO = 1200;
const SUELO = 1000;
const ORIGEN_X = 300;
const racimo = buscarArma("racimo-de-tuppers");

function mundo() {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  for (let y = SUELO; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) mascara.datos[y * ANCHO + x] = 1;
  return mascara;
}

// El punto en el que detona el portador, calculado sin pasar por el resolutor.
function detonacionDelPortador(mascara: ReturnType<typeof mundo>, anguloGrados: number, potencia: number) {
  const origenY = alturaSuperficie(mascara, ORIGEN_X) ?? ALTO - 1;
  const rad = (anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(potencia);
  const inicial = crearProyectil(ORIGEN_X, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  return simularVuelo(inicial, 1, 0, detenerseEnSuelo(mascara, ANCHO, ALTO), { encuadre: { ancho: ANCHO, alto: ALTO } });
}

function disparar(mascara: ReturnType<typeof mundo>, anguloGrados: number, potencia: number, objetivoX: number, objetivoY: number) {
  return resolverDisparo({
    mascara,
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(7),
    arma: racimo,
    origenX: ORIGEN_X,
    anguloGrados,
    potencia,
    objetivoX,
    objetivoY,
    ancho: ANCHO,
    alto: ALTO,
  });
}

const disparoArbitrario = fc.record({ angulo: fc.integer({ min: 5, max: 175 }), potencia: fc.integer({ min: 15, max: 100 }) });

test("rac-1: si el portador detona en P hay exactamente 5 detonaciones a <= 0,75 x RADIO_SUBMUNICION de P", () => {
  fc.assert(
    fc.property(disparoArbitrario, ({ angulo, potencia }) => {
      const mascara = mundo();
      const vuelo = detonacionDelPortador(mascara, angulo, potencia);
      const resultado = disparar(mascara, angulo, potencia, 1800, SUELO);
      if (vuelo.perdido) {
        // rac-1 (portador perdido): ni detonaciones ni daño.
        assert.equal(resultado.puntosDeImpacto.length, 0);
        assert.equal(resultado.danioObjetivo, 0);
        return;
      }
      assert.equal(resultado.puntosDeImpacto.length, 5);
      for (const punto of resultado.puntosDeImpacto) {
        assert.ok(Math.hypot(punto.x - vuelo.proyectil.x, punto.y - vuelo.proyectil.y) <= 0.75 * RADIO_SUBMUNICION + 1e-9);
        assert.equal(punto.vx, vuelo.proyectil.vx);
        assert.equal(punto.vy, vuelo.proyectil.vy);
      }
      // Entre dos cualesquiera, a <= 1,5 x RADIO_SUBMUNICION.
      for (const a of resultado.puntosDeImpacto) {
        for (const b of resultado.puntosDeImpacto) {
          assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= 1.5 * RADIO_SUBMUNICION + 1e-9);
        }
      }
    }),
    { numRuns: 500 },
  );
});

test("rac-1: el daño total a una misma nave nunca pasa de DANIO_MAXIMO_RACIMO_COMBINADO", () => {
  fc.assert(
    fc.property(disparoArbitrario, ({ angulo, potencia }) => {
      const mascara = mundo();
      const vuelo = detonacionDelPortador(mascara, angulo, potencia);
      if (vuelo.perdido) return;
      // Objetivo justo en P: el peor caso para el daño combinado.
      const resultado = disparar(mascara, angulo, potencia, vuelo.proyectil.x, vuelo.proyectil.y);
      assert.ok(resultado.danioObjetivo <= DANIO_MAXIMO_RACIMO_COMBINADO, `daño ${resultado.danioObjetivo}`);
      assert.equal(
        resultado.danioObjetivo,
        resultado.danioPorPunto.reduce((total, danio) => total + danio, 0),
      );
    }),
    { numRuns: 500 },
  );
});

test("rac-1: misma entrada, mismas 5 posiciones", () => {
  fc.assert(
    fc.property(disparoArbitrario, ({ angulo, potencia }) => {
      const a = disparar(mundo(), angulo, potencia, 1800, SUELO).puntosDeImpacto.map((p) => [p.x, p.y]);
      const b = disparar(mundo(), angulo, potencia, 1800, SUELO).puntosDeImpacto.map((p) => [p.x, p.y]);
      assert.deepEqual(a, b);
    }),
    { numRuns: 500 },
  );
});

test("rac-1: el tope solo reparte a la baja y no toca a las demás armas", () => {
  assert.deepEqual(limitarDanioCombinado(racimo, [3, 4]), [3, 4]);
  const repartido = limitarDanioCombinado(racimo, [20, 20, 20, 20, 20]);
  assert.ok(repartido.reduce((total, danio) => total + danio, 0) <= DANIO_MAXIMO_RACIMO_COMBINADO);
  assert.ok(repartido.every((danio) => danio > 0));
  assert.deepEqual(limitarDanioCombinado(buscarArma("pepinazo-cortesia"), [20, 20, 20, 20, 20]), [20, 20, 20, 20, 20]);
});

test("rac-1: un tiro fuera de pantalla no detona nada", () => {
  const resultado = disparar(mundo(), 90, 100, 1800, SUELO);
  // Vertical con la gravedad de la prueba el portador vuelve a tierra; a 90°
  // con gravedad 0 se pierde por arriba.
  const sinGravedad = resolverDisparo({
    mascara: mundo(),
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(7),
    arma: racimo,
    origenX: ORIGEN_X,
    anguloGrados: 90,
    potencia: 100,
    objetivoX: 1800,
    objetivoY: SUELO,
    ancho: ANCHO,
    alto: ALTO,
  });
  assert.equal(sinGravedad.proyectilPerdido, true);
  assert.equal(sinGravedad.puntosDeImpacto.length, 0);
  assert.ok(resultado.puntosDeImpacto.length === 0 || resultado.puntosDeImpacto.length === 5);
});
