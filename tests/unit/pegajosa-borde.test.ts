import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma, CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearMascaraPlana } from "../utils/terrenoPlano";

const ANCHO = 2000;
const ALTO = 1000;
const GRAVEDAD_BAJA = 0.02;
const MASCARA_PLANA = crearMascaraPlana(ANCHO, ALTO, 700);
// Sin ningún suelo: el único modo de acabar el vuelo es el fondo del mundo.
const MASCARA_SIN_SUELO = crearMascaraPlana(ANCHO, ALTO, ALTO);

type Borde = "arriba" | "izquierda" | "derecha";
const SALIDAS: Record<Borde, { origenX: number; angulo: number }> = {
  arriba: { origenX: 1000, angulo: 90 },
  izquierda: { origenX: 50, angulo: 180 },
  derecha: { origenX: 1950, angulo: 0 },
};

function disparar(armaId: string, semilla: number, opciones: { origenX: number; angulo: number; gravedad: number; mascara?: typeof MASCARA_PLANA; potencia?: number }) {
  return resolverDisparo({
    mascara: opciones.mascara ?? MASCARA_PLANA,
    gravedad: opciones.gravedad,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(semilla),
    arma: buscarArma(armaId),
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

// peg-2, invariante 1: un disparo perdido no deja detonaciones, huellas ni
// daño, sea cual sea el arma.
test("peg-2: todas las armas × 3 bordes × 50 semillas: el tiro perdido no detona ni toca el terreno", () => {
  fc.assert(
    fc.property(fc.constantFrom(...CATALOGO_ARMAS.map((a) => a.id)), fc.constantFrom<Borde>("arriba", "izquierda", "derecha"), fc.integer({ min: 1, max: 50 }), (armaId, borde, semilla) => {
      const r = disparar(armaId, semilla, { ...SALIDAS[borde], gravedad: GRAVEDAD_BAJA });
      if (!r.proyectilPerdido) return;
      assert.equal(r.puntosDeImpacto.length, 0, `${armaId} por ${borde}`);
      assert.equal(r.danioObjetivo, 0);
      assert.ok(Buffer.from(r.mascara.datos).equals(Buffer.from(MASCARA_PLANA.datos)), "la máscara cambió");
    }),
    { numRuns: 600 },
  );
});

// peg-2, invariante 2: el gancho, que antes se quedaba pegado, sale siempre
// por el borde por el que se fue.
test("peg-1: el Gancho Pegajoso que sale por arriba, izquierda o derecha se pierde con su borde de salida", () => {
  fc.assert(
    fc.property(fc.constantFrom<Borde>("arriba", "izquierda", "derecha"), fc.integer({ min: 1, max: 50 }), (borde, semilla) => {
      const r = disparar("gancho-pegajoso", semilla, { ...SALIDAS[borde], gravedad: GRAVEDAD_BAJA });
      assert.equal(r.proyectilPerdido, true);
      assert.equal(r.salida?.borde, borde);
    }),
    { numRuns: 150 },
  );
});

test("peg-1: el gancho que cae por un hueco del fondo se pierde con borde «abajo», no se pega", () => {
  const r = disparar("gancho-pegajoso", 3, { origenX: 1000, angulo: -80, gravedad: 1, potencia: 60, mascara: MASCARA_SIN_SUELO });
  assert.equal(r.proyectilPerdido, true);
  assert.equal(r.salida?.borde, "abajo");
  assert.equal(r.puntosDeImpacto.length, 0);
});

test("peg-1: el gancho que toca el suelo del planeta sigue anclándose", () => {
  const r = disparar("gancho-pegajoso", 3, { origenX: 1000, angulo: 45, gravedad: 1, potencia: 40 });
  assert.equal(r.proyectilPerdido, false);
  assert.equal(r.puntosDeImpacto.length, 1);
});

test("peg-2: el resto de armas sigue deteniéndose en el fondo del mundo", () => {
  const r = disparar("pepinazo-cortesia", 3, { origenX: 1000, angulo: -80, gravedad: 1, potencia: 60, mascara: MASCARA_SIN_SUELO });
  assert.equal(r.proyectilPerdido, false);
  assert.ok(r.puntosDeImpacto.length > 0);
});
