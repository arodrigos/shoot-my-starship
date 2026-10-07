import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { calcularPrevisualizacion } from "@/sim/armas/previsualizacion";
import { crearMascaraPlana } from "../utils/terrenoPlano";

const ANCHO = 2000;
const ALTO = 1000;
const ARMA = buscarArma("pepinazo-cortesia");
// Un tiro vertical con gravedad baja (la de un evento «gravedad /2» sobre un
// mundo ya ligero) sube mucho más allá del borde superior del mundo.
const GRAVEDAD_BAJA = 0.02;
const PASOS_DE_UN_VUELO_SIN_CORTE = 720;

function disparoVertical(gravedad: number) {
  return resolverDisparo({
    mascara: crearMascaraPlana(ANCHO, ALTO, 700),
    gravedad,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: ARMA,
    origenX: 1000,
    anguloGrados: 90,
    potencia: 100,
    objetivoX: 200,
    objetivoY: 700,
    objetivoId: 1,
    ancho: ANCHO,
    alto: ALTO,
  });
}

test("un disparo vertical con gravedad baja que sale por arriba termina en pocos pasos y no detona en el mundo", () => {
  const resultado = disparoVertical(GRAVEDAD_BAJA);
  assert.ok(resultado.pasosVuelo < PASOS_DE_UN_VUELO_SIN_CORTE / 2, `pasos: ${resultado.pasosVuelo}`);
  assert.equal(resultado.danioObjetivo, 0);
});

test("la previsualización tampoco sigue el trazado más allá del techo del vuelo", () => {
  const previa = calcularPrevisualizacion({
    mascara: crearMascaraPlana(ANCHO, ALTO, 700),
    gravedad: GRAVEDAD_BAJA,
    deriva: 0,
    ancho: ANCHO,
    alto: ALTO,
    origenX: 1000,
    anguloGrados: 90,
    potencia: 100,
    comportamiento: ARMA.comportamiento,
  });
  for (const punto of previa) assert.ok(punto.y >= -ALTO - 50, `el trazado no sigue más allá del techo: y=${punto.y}`);
});
