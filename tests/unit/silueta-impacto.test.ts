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
const ARMAS_DE_RADIO_PEQUENO = [buscarArma("zanjadora-manolita"), buscarArma("pelota-de-chatarra")];
const PUNTOS_POR_FAMILIA = 36;
const HOLGURA_FUERA_U = 0.6;

// Escrita a mano a partir de lo que se ve en pantalla (asientos pares a +x,
// impares a -x): si se sacara de direccionDeNave el test se compararía con la
// propia implementación y no vería que el núcleo y la cáscara se separan.
const ORIENTACION_DIBUJADA: Readonly<Record<IdNave, 1 | -1>> = { 0: 1, 1: -1, 2: 1, 3: -1 };

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
function dispararContraNave(id: IdNave, naveX: number, naveY: number, arma: typeof ARMA = ARMA) {
  return resolverDisparo({
    mascara: crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO),
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma,
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

// Punto a HOLGURA_FUERA_U por fuera del contorno, siguiendo la normal del lado
// (el signo sale del área con signo del polígono, así vale para formas cóncavas).
function puntosJustoFuera(contorno: readonly PuntoCasco[], cuantos: number): PuntoCasco[] {
  const area = contorno.reduce((suma, p, i) => {
    const q = contorno[(i + 1) % contorno.length];
    return suma + (p.x * q.y - q.x * p.y);
  }, 0);
  const signo = area > 0 ? 1 : -1;
  return puntosDelContorno(contorno, cuantos).map((punto) => {
    let mejor = { distancia: Infinity, nx: 0, ny: 0 };
    contorno.forEach((b, i) => {
      const a = contorno[(i + contorno.length - 1) % contorno.length];
      const largo = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const t = Math.max(0, Math.min(1, ((punto.x - a.x) * (b.x - a.x) + (punto.y - a.y) * (b.y - a.y)) / (largo * largo)));
      const distancia = Math.hypot(punto.x - (a.x + t * (b.x - a.x)), punto.y - (a.y + t * (b.y - a.y)));
      if (distancia < mejor.distancia) mejor = { distancia, nx: (signo * (b.y - a.y)) / largo, ny: (-signo * (b.x - a.x)) / largo };
    });
    return { x: punto.x + HOLGURA_FUERA_U * mejor.nx, y: punto.y + HOLGURA_FUERA_U * mejor.ny };
  });
}

const DETONACION = dispararContraNave(0, 0, 0).puntosDeImpacto[0];

test("sil-2: direccionDeNave coincide con la orientación con la que se dibuja cada asiento", () => {
  for (const id of [0, 1, 2, 3] as const) assert.equal(direccionDeNave(id), ORIENTACION_DIBUJADA[id]);
});

test("sil-2: para los puntos del contorno dibujado de cada asiento, distanciaACasco es 0", () => {
  for (const id of [0, 1, 2, 3] as const) {
    for (const punto of puntosDelContorno(puntosCascoVariante(id, ORIENTACION_DIBUJADA[id]), PUNTOS_POR_FAMILIA)) {
      assert.ok(distanciaACasco(punto.x, punto.y, { id, x: 0, y: 0 }) <= 1e-9, `asiento ${id}, punto (${punto.x}, ${punto.y})`);
    }
  }
});

test("sil-2: Zanjadora y Pelota de Chatarra (radio pequeño) a 0,6 u del contorno dibujado hacen daño en 36/36 por asiento", () => {
  for (const arma of ARMAS_DE_RADIO_PEQUENO) {
    const detonacion = dispararContraNave(0, 0, 0, arma).puntosDeImpacto[0];
    for (const id of [0, 1, 2, 3] as const) {
      let conDanio = 0;
      for (const punto of puntosJustoFuera(puntosCascoVariante(id, ORIENTACION_DIBUJADA[id]), PUNTOS_POR_FAMILIA)) {
        if (dispararContraNave(id, detonacion.x - punto.x, detonacion.y - punto.y, arma).danioObjetivo > 0) conDanio++;
      }
      assert.equal(conDanio, PUNTOS_POR_FAMILIA, `${arma.id}, asiento ${id}`);
    }
  }
});

test("sil-2: una explosión sobre cualquier punto del contorno visible de las cuatro siluetas hace daño (144/144)", () => {
  let conDanio = 0;
  for (const id of [0, 1, 2, 3] as const) {
    for (const punto of puntosDelContorno(puntosCascoVariante(id, ORIENTACION_DIBUJADA[id]), PUNTOS_POR_FAMILIA)) {
      const resultado = dispararContraNave(id, DETONACION.x - punto.x, DETONACION.y - punto.y);
      if (resultado.danioObjetivo > 0) conDanio++;
    }
  }
  assert.equal(conDanio, 4 * PUNTOS_POR_FAMILIA);
});

test("sil-2: pegada al centro el daño es el de siempre, y lejos de la silueta no hay daño", () => {
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

test("sil-2 (propiedad): una detonación dentro de la silueta hace el daño máximo del arma, y a más de radioEfecto no hace ninguno", () => {
  const efecto = ARMA.efecto;
  if (efecto.tipo !== "danio") throw new Error("el Pepinazo es un arma de daño");
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3 }), fc.double({ min: -60, max: 60, noNaN: true }), fc.double({ min: -60, max: 60, noNaN: true }), (id, x, y) => {
      const nave = { id: id as IdNave, x: 0, y: 0 };
      const distancia = distanciaACasco(x, y, nave);
      const danio = dispararContraNave(id as IdNave, DETONACION.x - x, DETONACION.y - y).danioObjetivo;
      if (distancia === 0) assert.equal(danio, efecto.danioMaximo);
      if (distancia >= efecto.radioEfectoPx) assert.equal(danio, 0);
    }),
    { numRuns: 300 },
  );
});
