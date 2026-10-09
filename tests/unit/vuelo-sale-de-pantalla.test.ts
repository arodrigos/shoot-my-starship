import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { calcularPrevisualizacion } from "@/sim/armas/previsualizacion";
import { MARGEN_SALIDA_U } from "@/sim/fisica/vuelo";
import { crearMascaraPlana } from "../utils/terrenoPlano";

const ANCHO = 2000;
const ALTO = 1000;
const ARMA = buscarArma("pepinazo-cortesia");
// Un tiro vertical con gravedad baja (la de un evento «gravedad /2» sobre un
// mundo ya ligero) sube mucho más allá del borde superior del mundo.
const GRAVEDAD_BAJA = 0.02;
const PASOS_DE_UN_VUELO_SIN_CORTE = 720;
// Una sola máscara para los property tests: resolverDisparo la clona y nunca la modifica.
const MASCARA_PLANA = crearMascaraPlana(ANCHO, ALTO, 700);

function disparo(opciones: { gravedad: number; origenX: number; angulo: number; potencia?: number; sueloY?: number }) {
  return resolverDisparo({
    mascara: crearMascaraPlana(ANCHO, ALTO, opciones.sueloY ?? 700),
    gravedad: opciones.gravedad,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: ARMA,
    origenX: opciones.origenX,
    anguloGrados: opciones.angulo,
    potencia: opciones.potencia ?? 100,
    objetivoX: 200,
    objetivoY: 700,
    objetivoId: 1,
    ancho: ANCHO,
    alto: ALTO,
  });
}

function previa(gravedad: number, origenX: number, angulo: number) {
  return calcularPrevisualizacion({
    mascara: MASCARA_PLANA,
    gravedad,
    deriva: 0,
    ancho: ANCHO,
    alto: ALTO,
    origenX,
    anguloGrados: angulo,
    potencia: 100,
    comportamiento: ARMA.comportamiento,
  });
}

test("sal-1: un tiro vertical que sale por arriba se pierde: sin daño, sin detonaciones y en pocos pasos", () => {
  const resultado = disparo({ gravedad: GRAVEDAD_BAJA, origenX: 1000, angulo: 90 });
  assert.equal(resultado.proyectilPerdido, true);
  assert.equal(resultado.salida?.borde, "arriba");
  assert.ok(resultado.salida!.y <= -MARGEN_SALIDA_U + 1e-6, `y de salida: ${resultado.salida!.y}`);
  assert.equal(resultado.danioObjetivo, 0);
  assert.equal(resultado.puntosDeImpacto.length, 0);
  assert.ok(resultado.pasosVuelo < PASOS_DE_UN_VUELO_SIN_CORTE / 2, `pasos: ${resultado.pasosVuelo}`);
});

test("sal-1: un tiro horizontal a la derecha desde el borde sale por la derecha", () => {
  const resultado = disparo({ gravedad: GRAVEDAD_BAJA, origenX: 1950, angulo: 0 });
  assert.equal(resultado.proyectilPerdido, true);
  assert.equal(resultado.salida?.borde, "derecha");
});

test("sal-1: un tiro horizontal a la izquierda desde el borde sale por la izquierda", () => {
  const resultado = disparo({ gravedad: GRAVEDAD_BAJA, origenX: 50, angulo: 180 });
  assert.equal(resultado.proyectilPerdido, true);
  assert.equal(resultado.salida?.borde, "izquierda");
});

test("sal-1: sin suelo bajo el tiro, el fondo del mundo sigue siendo suelo y detona ahí", () => {
  const resultado = disparo({ gravedad: 1, origenX: 1000, angulo: -80, potencia: 60, sueloY: ALTO + 500 });
  assert.equal(resultado.proyectilPerdido, false);
  assert.equal(resultado.salida, null);
  assert.ok(resultado.puntosDeImpacto.length > 0);
});

test("sal-1: un tiro que sube sin llegar al margen y vuelve NO se pierde", () => {
  // Gravedad normal: el vuelo sube y cae al suelo sin llegar a -24.
  const resultado = disparo({ gravedad: 1, origenX: 1000, angulo: 45, potencia: 40 });
  assert.equal(resultado.proyectilPerdido, false);
  assert.ok(resultado.puntosDeImpacto.length > 0);
});

test("la previsualización corta donde el vuelo se pierde, sin pasar del margen", () => {
  for (const punto of previa(GRAVEDAD_BAJA, 1000, 90)) {
    assert.ok(punto.y >= -MARGEN_SALIDA_U - 1e-6, `el trazado no sigue más allá del margen: y=${punto.y}`);
  }
});

// Invariante 1: ningún punto del vuelo simulado queda fuera del encuadre ampliado.
test("invariante: todos los puntos de la previsualización cumplen -24 ≤ x ≤ ancho+24 y -24 ≤ y ≤ alto+24", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: ANCHO }), fc.integer({ min: 0, max: 180 }), fc.constantFrom(0.02, 0.2, 1), (origenX, angulo, gravedad) => {
      for (const p of previa(gravedad, origenX, angulo)) {
        assert.ok(p.x >= -MARGEN_SALIDA_U - 1e-6 && p.x <= ANCHO + MARGEN_SALIDA_U + 1e-6, `x=${p.x}`);
        assert.ok(p.y >= -MARGEN_SALIDA_U - 1e-6 && p.y <= ALTO + MARGEN_SALIDA_U + 1e-6, `y=${p.y}`);
      }
    }),
    { numRuns: 500 },
  );
});

// Invariante 2: un disparo perdido no detona, no daña y no toca la máscara.
test("invariante: un disparo perdido no tiene detonaciones, daño ni cambios en la máscara", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: ANCHO }),
      fc.integer({ min: 0, max: 180 }),
      fc.integer({ min: 20, max: 100 }),
      fc.constantFrom(0.02, 0.2, 1),
      (origenX, angulo, potencia, gravedad) => {
        const r = resolverDisparo({
          mascara: MASCARA_PLANA,
          gravedad,
          deriva: 0,
          aleatorio: crearEstadoAleatorio(7),
          arma: ARMA,
          origenX,
          anguloGrados: angulo,
          potencia,
          objetivoX: 200,
          objetivoY: 700,
          objetivoId: 1,
          ancho: ANCHO,
          alto: ALTO,
        });
        if (!r.proyectilPerdido) return;
        assert.equal(r.puntosDeImpacto.length, 0);
        assert.equal(r.danioObjetivo, 0);
        assert.ok(Buffer.from(r.mascara.datos).equals(Buffer.from(MASCARA_PLANA.datos)), "la máscara cambió");
      },
    ),
    { numRuns: 500 },
  );
});

// Invariante 3: la previsualización y el vuelo real se pierden por el mismo sitio.
test("invariante: la previsualización no se extiende más allá de donde el disparo real se pierde", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: ANCHO }), fc.integer({ min: 0, max: 180 }), fc.constantFrom(0.02, 0.2), (origenX, angulo, gravedad) => {
      const r = disparo({ gravedad, origenX, angulo });
      if (!r.salida) return;
      const trazado = previa(gravedad, origenX, angulo);
      const ultimo = trazado[trazado.length - 1];
      // La previsualización es un prefijo del vuelo: nunca pasa del punto de salida real.
      const { borde } = r.salida;
      if (borde === "arriba") assert.ok(ultimo.y >= r.salida.y - 1e-6);
      if (borde === "abajo") assert.ok(ultimo.y <= r.salida.y + 1e-6);
      if (borde === "izquierda") assert.ok(ultimo.x >= r.salida.x - 1e-6);
      if (borde === "derecha") assert.ok(ultimo.x <= r.salida.x + 1e-6);
    }),
    { numRuns: 300 },
  );
});
