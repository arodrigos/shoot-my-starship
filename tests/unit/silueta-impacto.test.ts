import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { direccionDeNave, distanciaACasco } from "@/sim/naves/contacto";
import { puntosCascoVariante, type PuntoCasco } from "@/sim/naves/geometriaCasco";
import type { IdNave } from "@/sim/partida/tipos";
import { crearMascaraPlana } from "../utils/terrenoPlano";

const ANCHO = 2000;
const ALTO = 1000;
const ALTURA_SUELO = 700;
const ARMA = buscarArma("pepinazo-cortesia");
const PUNTOS_POR_FAMILIA = 36;

// Puntos equiespaciados por perímetro de la silueta que dibuja Nave.ts.
function puntosDelContorno(contorno: readonly PuntoCasco[], cuantos: number): PuntoCasco[] {
  const lados = contorno.map((punto, i) => ({ a: contorno[(i + contorno.length - 1) % contorno.length], b: punto }));
  const largos = lados.map(({ a, b }) => Math.hypot(b.x - a.x, b.y - a.y));
  const total = largos.reduce((suma, largo) => suma + largo, 0);
  return Array.from({ length: cuantos }, (_, k) => {
    let resto = (k / cuantos) * total;
    for (let i = 0; i < lados.length; i++) {
      if (resto <= largos[i]) {
        const t = largos[i] === 0 ? 0 : resto / largos[i];
        return { x: lados[i].a.x + t * (lados[i].b.x - lados[i].a.x), y: lados[i].a.y + t * (lados[i].b.y - lados[i].a.y) };
      }
      resto -= largos[i];
    }
    return contorno[0];
  });
}

// Detonación real del Pepinazo (vertical, sin naves que lo detengan): su punto
// de impacto es el mismo en todos los disparos, y se mueve la NAVE para que ese
// punto caiga justo donde se quiere sobre su silueta.
function dispararContraNave(id: IdNave, naveX: number, naveY: number) {
  return resolverDisparo({
    mascara: crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO),
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: ARMA,
    origenX: 1000,
    anguloGrados: 90,
    potencia: 60,
    objetivoX: naveX,
    objetivoY: naveY,
    objetivoId: id,
    ancho: ANCHO,
    alto: ALTO,
  });
}

const DETONACION = dispararContraNave(0, 0, 0).puntosDeImpacto[0];

test("sil-2: una explosión sobre cualquier punto del contorno visible de las cuatro siluetas hace daño (144/144)", () => {
  let conDanio = 0;
  for (const id of [0, 1, 2, 3] as const) {
    for (const punto of puntosDelContorno(puntosCascoVariante(id, direccionDeNave(id)), PUNTOS_POR_FAMILIA)) {
      const resultado = dispararContraNave(id, DETONACION.x - punto.x, DETONACION.y - punto.y);
      if (resultado.danioObjetivo > 0) conDanio++;
    }
  }
  assert.equal(conDanio, 4 * PUNTOS_POR_FAMILIA);
});

test("sil-2: dentro de la silueta el daño es el máximo del arma, y lejos de ella no hay daño", () => {
  const efecto = ARMA.efecto;
  if (efecto.tipo !== "danio") throw new Error("el Pepinazo es un arma de daño");
  assert.equal(dispararContraNave(0, DETONACION.x, DETONACION.y).danioObjetivo, efecto.danioMaximo);
  assert.equal(dispararContraNave(0, DETONACION.x + 400, DETONACION.y).danioObjetivo, 0);
});

test("sil-2: el centro de cada nave cae dentro de su silueta", () => {
  for (const id of [0, 1, 2, 3] as const) assert.equal(distanciaACasco(0, 0, { id, x: 0, y: 0 }), 0);
});

test("sil-2 (propiedad): la distancia a la silueta no es negativa ni supera la distancia al centro, que está dentro", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3 }), fc.double({ min: -300, max: 300, noNaN: true }), fc.double({ min: -300, max: 300, noNaN: true }), (id, x, y) => {
      const nave = { id: id as IdNave, x: 0, y: 0 };
      const distancia = distanciaACasco(x, y, nave);
      assert.ok(distancia >= 0);
      assert.ok(distancia <= Math.hypot(x, y) + 1e-9, "la silueta contiene el centro: nunca está más lejos que él");
    }),
    { numRuns: 300 },
  );
});
