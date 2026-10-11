import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { buscarArma } from "@/sim/armas/catalogo";
import {
  ALTURA_CANON_PX,
  RADIO_SUBMUNICION,
  SEPARACION_PERDIGON_U,
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

// Proyección de un punto sobre el eje perpendicular al rumbo del portador.
function proyeccionPerpendicular(punto: { x: number; y: number }, vuelo: ReturnType<typeof detonacionDelPortador>): number {
  const modulo = Math.hypot(vuelo.proyectil.vx, vuelo.proyectil.vy);
  const px = -vuelo.proyectil.vy / modulo;
  const py = vuelo.proyectil.vx / modulo;
  return (punto.x - vuelo.proyectil.x) * px + (punto.y - vuelo.proyectil.y) * py;
}

test("rac-1: como mucho 3 puntos y, separados 70 u sobre el eje perpendicular, sus cráteres nunca se solapan", () => {
  fc.assert(
    fc.property(disparoArbitrario, ({ angulo, potencia }) => {
      const mascara = mundo();
      const vuelo = detonacionDelPortador(mascara, angulo, potencia);
      const resultado = disparar(mascara, angulo, potencia, 1800, SUELO);
      if (vuelo.perdido) {
        assert.equal(resultado.puntosDeImpacto.length, 0);
        assert.equal(resultado.danioObjetivo, 0);
        return;
      }
      const puntos = resultado.puntosDeImpacto;
      assert.ok(puntos.length <= 3 && puntos.length >= 1);
      // El central detona en el punto del portador.
      assert.equal(puntos[0].x, vuelo.proyectil.x);
      assert.equal(puntos[0].y, vuelo.proyectil.y);
      const proyecciones = puntos.map((punto) => proyeccionPerpendicular(punto, vuelo)).sort((a, b) => a - b);
      for (let i = 1; i < proyecciones.length; i++) {
        assert.ok(Math.abs(proyecciones[i] - proyecciones[i - 1] - SEPARACION_PERDIGON_U) <= 0.5, `separación ${proyecciones[i] - proyecciones[i - 1]}`);
      }
      for (const a of puntos) {
        for (const b of puntos) {
          if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= SEPARACION_PERDIGON_U - 0.5);
        }
      }
      assert.ok(SEPARACION_PERDIGON_U > 2 * RADIO_SUBMUNICION);
    }),
    { numRuns: 500 },
  );
});

test("rac-1: un perdigón lateral ajustado a la superficie solo se desplaza a lo largo del rumbo y <= 70 u", () => {
  fc.assert(
    fc.property(disparoArbitrario, ({ angulo, potencia }) => {
      const mascara = mundo();
      const vuelo = detonacionDelPortador(mascara, angulo, potencia);
      if (vuelo.perdido) return;
      const resultado = disparar(mascara, angulo, potencia, 1800, SUELO);
      const modulo = Math.hypot(vuelo.proyectil.vx, vuelo.proyectil.vy);
      const rumbo = { x: vuelo.proyectil.vx / modulo, y: vuelo.proyectil.vy / modulo };
      const perpendicular = { x: -rumbo.y, y: rumbo.x };
      for (const punto of resultado.puntosDeImpacto.slice(1)) {
        const lado = Math.sign(proyeccionPerpendicular(punto, vuelo));
        const nominal = {
          x: vuelo.proyectil.x + perpendicular.x * lado * SEPARACION_PERDIGON_U,
          y: vuelo.proyectil.y + perpendicular.y * lado * SEPARACION_PERDIGON_U,
        };
        const desplazamiento = { x: punto.x - nominal.x, y: punto.y - nominal.y };
        assert.ok(Math.hypot(desplazamiento.x, desplazamiento.y) <= SEPARACION_PERDIGON_U + 1e-6);
        // Sin componente perpendicular: va solo a lo largo del rumbo.
        assert.ok(Math.abs(desplazamiento.x * perpendicular.x + desplazamiento.y * perpendicular.y) <= 1e-6);
      }
    }),
    { numRuns: 500 },
  );
});

test("rac-2: una nave recibe el daño del perdigón más fuerte, nunca la suma, y nunca más de 20", () => {
  fc.assert(
    fc.property(disparoArbitrario, ({ angulo, potencia }) => {
      const mascara = mundo();
      const vuelo = detonacionDelPortador(mascara, angulo, potencia);
      if (vuelo.perdido) return;
      // Objetivo justo en P: el central le da el daño máximo.
      const resultado = disparar(mascara, angulo, potencia, vuelo.proyectil.x, vuelo.proyectil.y);
      assert.ok(resultado.danioObjetivo <= 20, `daño ${resultado.danioObjetivo}`);
      assert.equal(
        resultado.danioObjetivo,
        resultado.danioPorPunto.reduce((total, danio) => total + danio, 0),
      );
      assert.equal(resultado.danioObjetivo, Math.max(...resultado.danioPorPunto));
    }),
    { numRuns: 500 },
  );
});

test("rac-1: misma entrada, mismos puntos", () => {
  fc.assert(
    fc.property(disparoArbitrario, ({ angulo, potencia }) => {
      const a = disparar(mundo(), angulo, potencia, 1800, SUELO).puntosDeImpacto.map((p) => [p.x, p.y]);
      const b = disparar(mundo(), angulo, potencia, 1800, SUELO).puntosDeImpacto.map((p) => [p.x, p.y]);
      assert.deepEqual(a, b);
    }),
    { numRuns: 500 },
  );
});

test("rac-2: limitarDanioCombinado da el máximo y no toca a las demás armas", () => {
  assert.deepEqual(limitarDanioCombinado(racimo, [20, 20, 20]), [20, 0, 0]);
  assert.deepEqual(limitarDanioCombinado(racimo, [0, 12, 7]), [0, 12, 0]);
  assert.deepEqual(limitarDanioCombinado(racimo, [0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(limitarDanioCombinado(buscarArma("pepinazo-cortesia"), [20, 20, 20]), [20, 20, 20]);
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
  assert.ok(resultado.puntosDeImpacto.length === 0 || resultado.puntosDeImpacto.length <= 3);
});
