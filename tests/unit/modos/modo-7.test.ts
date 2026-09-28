import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { decidirTurnoIA } from "@/sim/ia/decidir";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { ALMIRANTE_BISAGRA, LA_CONTABLE } from "@/sim/ia/personalidades";
import { jugarPartida } from "@/sim/partida/motor";
import { SALDO_INICIAL, puedeCostearArma } from "@/sim/partida/economia";
import type { EstadoPartida, FuenteDeTurno, ParametrosMundo } from "@/sim/partida/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const ALTURA_SUELO = 900;
const NUMERO_PARTIDAS = 200;
const LIMITE_TURNOS = 60;

const MUNDO: ParametrosMundo = { ancho: ANCHO, alto: ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "sin deriva" };

// Almirante Bisagra es la personalidad de dificultad MEDIA del catálogo
// (ia-3: "dificultad media... no regala nada"), el sustituto declarado por
// modo-7 de "puntería media" -- reutiliza el MISMO cálculo de error que
// decidirTurnoIA/crearFuenteIA usan para la IA real, no una aproximación
// aparte, así que el ruido de puntería del jugador simulado es genuino.
const PUNTERIA_MEDIA = ALMIRANTE_BISAGRA;

// El jugador simulado: la misma solución balística/error de ia-personalidades
// (decidirTurnoIA) decide ÁNGULO y POTENCIA -- lo único que modo-7 sustituye
// es la elección de arma, que aquí SÍ respeta el saldo (al contrario que la
// IA rival, que nunca conoce presupuesto, ver desviaciones del entregable).
// "La mejor que se puede pagar" es la política greedy más simple que un
// jugador real seguiría con presupuesto limitado.
function fuenteJugadorConPresupuesto(): FuenteDeTurno {
  return (estado: EstadoPartida) => {
    const naveJugador = estado.naves[0];
    const naveRival = estado.naves[1];
    const decision = decidirTurnoIA({
      mascara: estado.mascara,
      origenX: naveJugador.x,
      objetivoX: naveRival.x,
      gravedad: estado.mundo.gravedad,
      deriva: estado.mundo.deriva,
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      personalidad: PUNTERIA_MEDIA,
      aleatorio: estado.aleatorio,
      ultimoIntento: null,
    });

    const saldo = estado.saldo ?? 0;
    const asequibles = CATALOGO_ARMAS.filter((arma) => puedeCostearArma(arma, saldo));
    // Siempre hay al menos una (las tres gratis, coste 0, nunca dejan de
    // caber en cualquier saldo >= 0) -- el invariante que modo-7 exige.
    const elegida = asequibles.reduce((mejor, candidata) => {
      const danioMejor = mejor.efecto.tipo === "empuje" ? 0 : mejor.efecto.danioMaximo;
      const danioCandidata = candidata.efecto.tipo === "empuje" ? 0 : candidata.efecto.danioMaximo;
      return danioCandidata > danioMejor ? candidata : mejor;
    });

    return {
      entrada: { arma: elegida.id, anguloGrados: decision.entrada.anguloGrados, potencia: decision.entrada.potencia },
      estado: { ...estado, aleatorio: decision.aleatorio },
    };
  };
}

test("modo-7: el catálogo garantiza que siempre hay un arma asequible (las tres gratis, coste 0)", () => {
  for (let saldo = 0; saldo <= SALDO_INICIAL; saldo += 50) {
    const asequibles = CATALOGO_ARMAS.filter((arma) => puedeCostearArma(arma, saldo));
    assert.ok(asequibles.length >= 3, `saldo ${saldo}: menos de 3 armas asequibles`);
    assert.ok(
      asequibles.some((arma) => (arma.efecto.tipo !== "empuje" ? arma.efecto.danioMaximo : 0) > 0),
      `saldo ${saldo}: ninguna arma asequible hace daño real`,
    );
  }
});

test("modo-7: en 200 partidas simuladas en modo presupuesto, el saldo final no se agota en más del 20% ni triplica el inicial en más del 20%", () => {
  let agotadas = 0;
  let triplicadas = 0;
  let jugadas = 0;

  for (let semilla = 0; semilla < NUMERO_PARTIDAS; semilla++) {
    const mascara = crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO);
    const estadoInicial: EstadoPartida = {
      version: 1,
      mundo: MUNDO,
      mascara,
      naves: [
        { x: Math.round(ANCHO * 0.2), integridad: 100 },
        { x: Math.round(ANCHO * 0.8), integridad: 100 },
      ],
      turno: 0,
      numeroTurno: 0,
      aleatorio: crearEstadoAleatorio(semilla + 1),
      resultado: { tipo: "en-curso" },
      modo: "presupuesto",
      saldo: SALDO_INICIAL,
    };

    const resultado = jugarPartida(estadoInicial, [fuenteJugadorConPresupuesto(), crearFuenteIA(LA_CONTABLE)], LIMITE_TURNOS);
    jugadas += 1;
    const saldoFinal = resultado.estado.saldo ?? 0;
    if (saldoFinal <= 0) agotadas += 1;
    if (saldoFinal > SALDO_INICIAL * 3) triplicadas += 1;
  }

  const fraccionAgotadas = agotadas / jugadas;
  const fraccionTriplicadas = triplicadas / jugadas;
  assert.ok(fraccionAgotadas <= 0.2, `saldo agotado en ${(fraccionAgotadas * 100).toFixed(1)}% de las partidas (límite 20%)`);
  assert.ok(
    fraccionTriplicadas <= 0.2,
    `saldo por encima del triple en ${(fraccionTriplicadas * 100).toFixed(1)}% de las partidas (límite 20%)`,
  );
});
