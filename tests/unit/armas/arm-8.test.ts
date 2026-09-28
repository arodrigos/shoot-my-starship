import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { crearMascaraVacia, esSolido, SOLIDO } from "@/sim/terreno/mascara";

const ANCHO = 1920;
const ALTO = 1080;
const ORIGEN_Y = 500;
const FILA_DE_VUELO = ORIGEN_Y - 26; // ALTURA_CANON_PX

function crearMuroEn(xInicio: number, xFin: number) {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  for (let y = FILA_DE_VUELO - 40; y < FILA_DE_VUELO + 40; y++) {
    for (let x = xInicio; x < xFin; x++) {
      mascara.datos[y * ANCHO + x] = SOLIDO;
    }
  }
  return mascara;
}

function dispararRecto(armaId: string, mascara: ReturnType<typeof crearMuroEn>, naveObjetivoX: number) {
  return resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: buscarArma(armaId),
    origenX: 200,
    origenY: ORIGEN_Y,
    anguloGrados: 0,
    potencia: 40,
    objetivoX: naveObjetivoX,
    objetivoY: FILA_DE_VUELO,
    ancho: ANCHO,
    alto: ALTO,
    naves: [
      { id: 0, x: 200, y: ORIGEN_Y },
      { id: 1, x: naveObjetivoX, y: FILA_DE_VUELO },
    ],
    tiradorId: 0,
  });
}

test("arm-8: la Barrena Planetaria detona SIEMPRE en un casco, aunque le quede penetración de sobra y haya planeta detrás", () => {
  const NAVE_X = 600;
  const MURO_X = [900, 960] as const; // detrás de la nave, dentro del alcance de penetración (260px)
  const mascara = crearMuroEn(...MURO_X);

  const resultado = dispararRecto("barrena-planetaria", mascara, NAVE_X);

  assert.equal(resultado.puntosDeImpacto.length, 1);
  assert.equal(resultado.puntosDeImpacto[0].impactoNave, 1, "la Barrena debería detonar en el casco de la nave 1, no perforarlo");
  assert.ok(Math.abs(resultado.puntosDeImpacto[0].x - NAVE_X) < 30, "el punto de impacto debería estar en la nave, no más allá");
  // El muro, más allá de la nave, nunca llega a tocarse.
  assert.equal(esSolido(resultado.mascara, MURO_X[0] + 10, FILA_DE_VUELO), true, "el muro detrás de la nave no debería haberse abierto");
});

test("arm-8: el Rayo Láser se detiene en el primer casco cuando hay un planeta detrás", () => {
  const NAVE_X = 600;
  const MURO_X = [900, 960] as const;
  const mascara = crearMuroEn(...MURO_X);

  const resultado = dispararRecto("rayo-laser", mascara, NAVE_X);

  assert.equal(resultado.puntosDeImpacto.length, 1);
  assert.equal(resultado.puntosDeImpacto[0].impactoNave, 1, "el láser debería parar en el casco de la nave 1");
  assert.ok(resultado.danioObjetivo > 0, "el impacto en casco debe causar daño en ese punto");
});

test("arm-8: el Rayo Láser se detiene en el primer sólido cuando el planeta está delante de la nave, y la nave no recibe daño", () => {
  const MURO_X = [600, 660] as const;
  const NAVE_X = 900; // detrás del muro
  const mascara = crearMuroEn(...MURO_X);

  const resultado = dispararRecto("rayo-laser", mascara, NAVE_X);

  assert.equal(resultado.puntosDeImpacto.length, 1);
  assert.equal(resultado.puntosDeImpacto[0].impactoNave, undefined, "el láser debería parar en sólido, no en la nave");
  assert.ok(resultado.puntosDeImpacto[0].x < MURO_X[1] + 10, "el punto de impacto debería quedarse en el muro");
  assert.equal(resultado.danioObjetivo, 0, "la nave, detrás del planeta, no debería recibir daño");
});
