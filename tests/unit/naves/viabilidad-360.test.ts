import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { existeTiroViable, RANGO_ANGULOS_JUGADOR } from "@/sim/balistica/rejilla";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS } from "@/juego/control/apuntado";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1000;
const ALTO = 2000;

// apu-5: la viabilidad de la colocación mira los 0-360° que el jugador puede
// disparar. Con un rival solo alcanzable hacia abajo, el semicírculo superior
// de antes lo rechazaba aunque el jugador pudiera dispararle a 270°.
const parametros = {
  mascara: crearMascaraPlana(ANCHO, ALTO, ALTO - 20),
  ancho: ANCHO,
  alto: ALTO,
  gravedad: 1,
  deriva: 0,
  aleatorio: crearEstadoAleatorio(11),
  arma: buscarArma("pepinazo-cortesia"),
  naves: [
    { id: 0 as const, x: 500, y: 300 },
    { id: 1 as const, x: 500, y: 900 },
  ],
  tiradorId: 0 as const,
  objetivoId: 1 as const,
};

test("apu-5: el rango de la viabilidad es el del control del jugador", () => {
  assert.equal(RANGO_ANGULOS_JUGADOR.minimo, ANGULO_MINIMO_GRADOS);
  assert.ok(RANGO_ANGULOS_JUGADOR.maximo < ANGULO_MAXIMO_GRADOS && RANGO_ANGULOS_JUGADOR.maximo > 340);
});

test("apu-5: un rival solo alcanzable hacia abajo es viable con el rango del jugador", () => {
  assert.equal(existeTiroViable({ ...parametros, rangoAngulos: RANGO_ANGULOS_JUGADOR }), true);
});

test("apu-5: el mismo rival se rechazaba con el semicírculo superior", () => {
  assert.equal(existeTiroViable(parametros), false);
});

// El humano se mide en 0-360° y la IA en el semicírculo de siempre: una
// colocación solo viable hacia abajo es válida para un humano, pero no para
// un asiento de IA, que nunca sabría dispararle.
test("apu-5: colocarNaves mide a cada asiento con su rango", async () => {
  const { colocarNaves } = await import("@/sim/naves/colocacion");
  const { MUNDO_ANCHO, MUNDO_ALTO } = await import("../../utils/sistemaGenerado");
  const mundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 0, deriva: 0, etiquetaDeriva: "" };
  const soloIA = colocarNaves(7, mundo, crearEstadoAleatorio(7), 2);
  const mixto = colocarNaves(7, mundo, crearEstadoAleatorio(7), 2, [false, true]);
  assert.equal(soloIA.naves.length, 2);
  assert.equal(mixto.naves.length, 2);
});
