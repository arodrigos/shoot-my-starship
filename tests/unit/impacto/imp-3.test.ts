import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 2000;
const ALTO = 1000;
const ALTURA_SUELO = 700;
const ORIGEN_X = 1000;

test("imp-3: el daño se mide en distancia euclídea 2D al punto de detonación, nunca solo en X", () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const efecto = armaBase.efecto;
  if (efecto.tipo !== "danio") {
    throw new Error("imp-3 espera que el arma base sea de tipo daño");
  }
  assert.ok(efecto.radioEfectoPx < 100, "el radio de daño del arma base debe quedar por debajo de 100px para que el test tenga sentido");

  const mascara = crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO);

  function disparar(objetivoX: number, objetivoY: number) {
    return resolverDisparo({
      mascara,
      gravedad: 1,
      deriva: 0,
      aleatorio: crearEstadoAleatorio(1),
      arma: armaBase,
      // Vertical puro (vx=0 durante todo el vuelo): el punto real de
      // detonación cae siempre en la misma columna, así que las tres ramas de
      // abajo miden distancia contra el MISMO punto de impacto.
      origenX: ORIGEN_X,
      anguloGrados: 90,
      potencia: 60,
      objetivoX,
      objetivoY,
      ancho: ANCHO,
      alto: ALTO,
    });
  }

  const punto = disparar(ORIGEN_X, ALTURA_SUELO).puntosDeImpacto[0];

  // Mismo X que el punto de detonación, 100px por debajo en Y (fuera del
  // radio de daño): con la medida antigua en X (dx=0) esto habría dado el
  // daño MÁXIMO -- exactamente el bug que corrige este bloque.
  const encima = disparar(punto.x, punto.y - 100);
  assert.equal(encima.danioObjetivo, 0, "una detonación a 100px euclídeos, aunque comparta X con el punto medido, no debe hacer daño");

  // 20px de distancia euclídea real (terna 12-16-20: ningún eje por separado
  // llega a 20).
  const cerca = disparar(punto.x + 12, punto.y - 16);
  assert.ok(
    cerca.danioObjetivo > 0.6 * efecto.danioMaximo,
    `a 20px euclídeos el daño (${cerca.danioObjetivo}) debe superar el 60% del máximo (${efecto.danioMaximo})`,
  );

  // 100px en horizontal puro y 100px en vertical puro deben dar EXACTAMENTE
  // el mismo daño: la distancia no puede depender de qué eje se recorre.
  const horizontal100 = disparar(punto.x + 100, punto.y);
  assert.equal(horizontal100.danioObjetivo, encima.danioObjetivo, "100px en horizontal y 100px en vertical deben causar el mismo daño");
});
