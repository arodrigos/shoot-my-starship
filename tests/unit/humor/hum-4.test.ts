import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { ALTURA_CANON_PX, resolverDisparo, type ResultadoDisparo } from "@/sim/armas/resolver";
import { crearMascaraVacia, ESCOMBRO, SOLIDO, type Mascara } from "@/sim/terreno/mascara";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { categorizarResultado, UMBRAL_CASI_PX } from "@/sim/partida/categoriaBroma";

const ANCHO = 3000;
const ALTO = 2000;

// Base mínima de ResultadoDisparo -- mismo patrón que
// tests/unit/humor/eventosHumor.test.ts: solo los campos que categorizarResultado
// lee, para las categorías que no requieren un vuelo real.
function resultado(parcial: Partial<ResultadoDisparo>): ResultadoDisparo {
  return {
    mascara: crearMascaraVacia(ANCHO, ALTO),
    aleatorio: crearEstadoAleatorio(0),
    puntosDeImpacto: [],
    danioPorPunto: [],
    danioObjetivo: 0,
    danioPropio: 0,
    impactoPropio: null,
    desplazamientoObjetivoPx: 0,
    origenY: 0,
    fallo: false,
    proyectilPerdido: false,
    roce: null,
    ...parcial,
  };
}

test("hum-4: acierto -- un impacto directo en el casco (resolverDisparo real) se categoriza como 'acierto'", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const origenY = 500;
  const filaDeVuelo = origenY - ALTURA_CANON_PX;
  const objetivoX = 1500;
  const res = resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: buscarArma("pepinazo-cortesia"),
    origenX: 200,
    origenY,
    anguloGrados: 0,
    potencia: 40,
    objetivoX,
    objetivoY: filaDeVuelo,
    ancho: ANCHO,
    alto: ALTO,
    naves: [
      { id: 0, x: 200, y: origenY },
      { id: 1, x: objetivoX, y: filaDeVuelo },
    ],
    tiradorId: 0,
  });

  assert.equal(res.puntosDeImpacto[0]?.impactoNave, 1, "precondición: el disparo real debe golpear el casco de la nave 1");
  const categoria = categorizarResultado({
    resultado: res,
    mascaraAntes: mascara,
    objetivoId: 1,
    objetivoX,
    objetivoY: filaDeVuelo,
  });
  assert.equal(categoria, "acierto");
});

test("hum-4: autoimpacto -- la gravedad devuelve el disparo sobre el propio casco (resolverDisparo real) se categoriza como 'autoimpacto'", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const naveX = 1500;
  const naveY = 1500;
  const planetas: RegistroPlanetas = [{ id: 1, cx: naveX, cy: naveY + 300, radio: 50, densidad: 1_000_000, pixelesVivos: 20 }];

  const res = resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: buscarArma("pepinazo-cortesia"),
    origenX: naveX,
    origenY: naveY,
    anguloGrados: 88,
    potencia: 20,
    objetivoX: naveX + 3000,
    objetivoY: naveY,
    ancho: ANCHO,
    alto: ALTO,
    planetas,
    naves: [
      { id: 0, x: naveX, y: naveY },
      { id: 1, x: naveX + 3000, y: naveY },
    ],
    tiradorId: 0,
  });

  assert.notEqual(res.impactoPropio, null, "precondición: el disparo real debe autoimpactar por gravedad");
  const categoria = categorizarResultado({
    resultado: res,
    mascaraAntes: mascara,
    objetivoId: 1,
    objetivoX: naveX + 3000,
    objetivoY: naveY,
  });
  assert.equal(categoria, "autoimpacto");
});

test("hum-4: proyectil-perdido -- la bandera de simularVuelo manda, sin mirar puntosDeImpacto", () => {
  const categoria = categorizarResultado({
    resultado: resultado({ proyectilPerdido: true }),
    mascaraAntes: crearMascaraVacia(ANCHO, ALTO),
    objetivoId: 1,
    objetivoX: 1000,
    objetivoY: 500,
  });
  assert.equal(categoria, "proyectil-perdido");
});

test("hum-4: autoimpacto por daño propio (Despedida) también se categoriza como 'autoimpacto', sin necesitar impactoPropio", () => {
  const categoria = categorizarResultado({
    resultado: resultado({ danioPropio: 12 }),
    mascaraAntes: crearMascaraVacia(ANCHO, ALTO),
    objetivoId: 1,
    objetivoX: 1000,
    objetivoY: 500,
  });
  assert.equal(categoria, "autoimpacto");
});

test("hum-4: casi -- el punto de detonación cae dentro del umbral de 'casi' pero no sobre el casco", () => {
  const objetivoX = 1000;
  const objetivoY = 500;
  const categoria = categorizarResultado({
    resultado: resultado({ puntosDeImpacto: [{ x: objetivoX + UMBRAL_CASI_PX - 5, y: objetivoY }] }),
    mascaraAntes: crearMascaraVacia(ANCHO, ALTO),
    objetivoId: 1,
    objetivoX,
    objetivoY,
  });
  assert.equal(categoria, "casi");
});

test("hum-4: fallo-lejano -- el punto de detonación cae en el vacío, lejos del objetivo y sin material sólido", () => {
  const objetivoX = 1000;
  const objetivoY = 500;
  const categoria = categorizarResultado({
    resultado: resultado({ puntosDeImpacto: [{ x: objetivoX + 900, y: objetivoY }] }),
    mascaraAntes: crearMascaraVacia(ANCHO, ALTO),
    objetivoId: 1,
    objetivoX,
    objetivoY,
  });
  assert.equal(categoria, "fallo-lejano");
});

function conMaterialEn(material: number, x: number, y: number): Mascara {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  mascara.datos[y * ANCHO + x] = material;
  return mascara;
}

test("hum-4: impacto-planeta -- el punto de detonación, lejos del objetivo, cae sobre material de planeta", () => {
  const objetivoX = 1000;
  const objetivoY = 500;
  const punto = { x: objetivoX + 900, y: objetivoY };
  const categoria = categorizarResultado({
    resultado: resultado({ puntosDeImpacto: [punto] }),
    mascaraAntes: conMaterialEn(SOLIDO, punto.x, punto.y),
    objetivoId: 1,
    objetivoX,
    objetivoY,
  });
  assert.equal(categoria, "impacto-planeta");
});

test("hum-4: impacto-escombro -- el punto de detonación, lejos del objetivo, cae sobre escombro", () => {
  const objetivoX = 1000;
  const objetivoY = 500;
  const punto = { x: objetivoX + 900, y: objetivoY };
  const categoria = categorizarResultado({
    resultado: resultado({ puntosDeImpacto: [punto] }),
    mascaraAntes: conMaterialEn(ESCOMBRO, punto.x, punto.y),
    objetivoId: 1,
    objetivoX,
    objetivoY,
  });
  assert.equal(categoria, "impacto-escombro");
});
