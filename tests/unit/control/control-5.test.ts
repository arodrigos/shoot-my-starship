import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 800;
const ALTO = 600;

// control-5 (repetir último disparo): la promesa de "precarga
// ángulo/potencia/arma y con la misma deriva el impacto cae a <=2px del
// anterior" solo puede sostenerse si, a igualdad de mascara/origen/deriva,
// el mismo disparo produce siempre el mismo impacto -- esta es esa garantía,
// comprobada directamente sobre resolverDisparo (sin pasar por el control ni
// por un turno real de la máquina, que sí puede cambiar el terreno de por
// medio y con él el resultado, legítimamente: eso no es un fallo de
// "repetir", es que el campo de batalla cambió).
test("control-5: mismo arma/ángulo/potencia/origen/deriva -> mismo impacto, sin importar cuántas veces se repita", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 400);
  const arma = buscarArma("pepinazo-cortesia");
  const parametros = {
    mascara,
    gravedad: 1.0,
    deriva: -18,
    aleatorio: crearEstadoAleatorio(7),
    arma,
    origenX: 120,
    anguloGrados: 45,
    potencia: 62,
    objetivoX: 500,
    objetivoY: 400,
    ancho: ANCHO,
    alto: ALTO,
  };

  const primero = resolverDisparo(parametros);
  const segundo = resolverDisparo(parametros);

  assert.equal(primero.fallo, false);
  assert.equal(segundo.fallo, false);
  assert.deepEqual(primero.puntosDeImpacto[0], segundo.puntosDeImpacto[0]);
});
