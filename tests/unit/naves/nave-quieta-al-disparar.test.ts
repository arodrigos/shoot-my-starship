import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";

const ANCHO = 4000;
const ALTO = 4000;
const TIRADOR = { id: 0 as const, x: 1000, y: 2000 };
const RIVAL = { id: 1 as const, x: 3500, y: 2000 };

// Armas con autodaño fijo por catálogo (Despedida): su daño propio es
// garantizado y no es el defecto que se persigue aquí.
const ARMAS = CATALOGO_ARMAS.filter((arma) => arma.efecto.tipo !== "danio-y-autodanio");

function disparar(armaIndice: number, angulo: number, potencia: number) {
  return resolverDisparo({
    mascara: crearMascaraVacia(ANCHO, ALTO),
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(7),
    arma: ARMAS[armaIndice],
    origenX: TIRADOR.x,
    origenY: TIRADOR.y,
    anguloGrados: angulo,
    potencia,
    objetivoX: RIVAL.x,
    objetivoY: RIVAL.y,
    objetivoId: RIVAL.id,
    ancho: ANCHO,
    alto: ALTO,
    naves: [TIRADOR, RIVAL],
    tiradorId: TIRADOR.id,
  });
}

// qui-1 / invariante: sin gravedad ni planetas el tiro nunca vuelve, así que
// el tirador no puede recibir impacto propio de su propio vuelo.
test("qui-1: ningún disparo, desde cualquier ángulo y arma, toca al propio tirador", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: ARMAS.length - 1 }),
      // Rango jugable (2°-178°): el cañón está encima del casco y un tiro hacia
      // abajo atraviesa la propia silueta, que ya no es un círculo más bajo
      // que el cañón.
      fc.integer({ min: 2, max: 178 }),
      fc.integer({ min: 10, max: 100 }),
      (arma, angulo, potencia) => {
        const resultado = disparar(arma, angulo, potencia);
        assert.equal(resultado.impactoPropio, null);
              assert.equal(resultado.puntosDeImpacto.some((punto) => punto.impactoNave === TIRADOR.id), false);
      },
    ),
    { numRuns: 500 },
  );
});

// qui-2: regresión del defecto. Hacia atrás (170°) el proyectil sale rozando
// la silueta propia, que llega bastante más lejos que la gracia vieja.
test("qui-2: un tiro hacia atrás por encima del casco no impacta al tirador", () => {
  const resultado = disparar(0, 170, 60);
  assert.equal(resultado.impactoPropio, null);
});
