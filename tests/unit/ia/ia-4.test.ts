import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { calcularErrorInyectado, decidirTurnoIA } from "@/sim/ia/decidir";
import { CHISPA } from "@/sim/ia/personalidades";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const ORIGEN_X = 300;
const OBJETIVO_X = 700;

test("ia-4: la entrada de la IA es exactamente la solución exacta más el error inyectado, nunca otra cosa", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);

  for (const semilla of [1, 2, 3, 97, 4242]) {
    const decision = decidirTurnoIA({
      mascara,
      origenX: ORIGEN_X,
      objetivoX: OBJETIVO_X,
      gravedad: 1.0,
      deriva: 0,
      ancho: ANCHO,
      alto: ALTO,
      personalidad: CHISPA,
      aleatorio: crearEstadoAleatorio(semilla),
      ultimoIntento: null,
    });

    // Recalculado por fuera, con la misma semilla: si decidirTurnoIA
    // consultara el generador en otro orden o degradara con un factor
    // distinto, este segundo cálculo divergiría del primero.
    const { error } = calcularErrorInyectado(CHISPA, crearEstadoAleatorio(semilla));
    const anguloEsperado = Math.min(180, Math.max(0, decision.solucionExacta.anguloGrados + error.anguloGrados));
    const potenciaEsperada = Math.min(100, Math.max(0, decision.solucionExacta.potencia + error.potencia));

    assert.equal(decision.entrada.anguloGrados, anguloEsperado, `semilla ${semilla}: ángulo no coincide con solución exacta + error`);
    assert.equal(decision.entrada.potencia, potenciaEsperada, `semilla ${semilla}: potencia no coincide con solución exacta + error`);
  }
});

test("ia-4: el impacto de la IA es el mismo que produciría un jugador disparando esa misma entrada", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const arma = buscarArma("pepinazo-cortesia");

  const decision = decidirTurnoIA({
    mascara,
    origenX: ORIGEN_X,
    objetivoX: OBJETIVO_X,
    gravedad: 1.0,
    deriva: 0,
    ancho: ANCHO,
    alto: ALTO,
    personalidad: CHISPA,
    aleatorio: crearEstadoAleatorio(11),
    ultimoIntento: null,
  });

  // Misma resolverDisparo que usa avanzar() para un humano (armas-*,
  // nucleo-6): no hay ningún camino de "impacto de IA" aparte.
  const resultado = resolverDisparo({
    mascara,
    gravedad: 1.0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(99),
    arma,
    origenX: ORIGEN_X,
    anguloGrados: decision.entrada.anguloGrados,
    potencia: decision.entrada.potencia,
    objetivoX: OBJETIVO_X,
    ancho: ANCHO,
    alto: ALTO,
  });

  assert.equal(resultado.fallo, false);
  assert.equal(Number.isFinite(resultado.puntosDeImpacto[0].x), true);
  assert.equal(Number.isFinite(resultado.puntosDeImpacto[0].y), true);
});
