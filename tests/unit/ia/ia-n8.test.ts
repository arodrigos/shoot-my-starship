import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { decidirTurnoIA } from "@/sim/ia/decidir";
import { CHISPA } from "@/sim/ia/personalidades";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const ORIGEN_X = 300;
const OBJETIVO_X = 1400;
const NUM_TURNOS = 500;
const TECHO_FRECUENCIA_ARMA_SIN_DANIO = 0.12;

// Réplica de danioMaximoDeArma en decidir.ts (privada a propósito: es
// detalle interno de la política de arma, no contrato público) -- el mismo
// criterio que ia-n8 exige comparar sin reimplementar la política entera.
function danioMaximoDeArma(armaId: string): number {
  const arma = buscarArma(armaId);
  return arma.efecto.tipo === "empuje" ? 0 : arma.efecto.danioMaximo;
}

test("ia-n8: Chispa elige un arma de daño máximo 0 en el 12% o menos de 500 turnos", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  let elegidasSinDanio = 0;

  for (let turno = 0; turno < NUM_TURNOS; turno++) {
    const decision = decidirTurnoIA({
      mascara,
      origenX: ORIGEN_X,
      objetivoX: OBJETIVO_X,
      gravedad: 1.0,
      deriva: 0,
      ancho: ANCHO,
      alto: ALTO,
      personalidad: CHISPA,
      aleatorio: crearEstadoAleatorio(turno),
      ultimoIntento: { distanciaAlObjetivoPx: 0, fallosConsecutivos: 0, turnosSeguidosSinDanio: 0 },
    });
    assert.equal(decision.bloqueada, false, `turno ${turno}: el escenario debía tener tiro viable`);
    if (danioMaximoDeArma(decision.entrada.arma) === 0) {
      elegidasSinDanio++;
    }
  }

  const frecuencia = elegidasSinDanio / NUM_TURNOS;
  assert.ok(
    frecuencia <= TECHO_FRECUENCIA_ARMA_SIN_DANIO,
    `Chispa eligió un arma de daño 0 en el ${(frecuencia * 100).toFixed(1)}% de ${NUM_TURNOS} turnos, techo ${TECHO_FRECUENCIA_ARMA_SIN_DANIO * 100}%`,
  );
});

test("ia-n8: tras dos turnos consecutivos sin causar daño, el tercero usa obligatoriamente un arma con daño mayor que 0", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);

  // Muchas semillas distintas: la regla es dura (por encima de la política
  // de personalidad, que es probabilística), así que tiene que cumplirse
  // SIEMPRE, no solo en el caso que más convenga.
  for (let semilla = 0; semilla < 100; semilla++) {
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
      ultimoIntento: { distanciaAlObjetivoPx: 0, fallosConsecutivos: 0, turnosSeguidosSinDanio: 2 },
    });
    assert.ok(
      danioMaximoDeArma(decision.entrada.arma) > 0,
      `semilla ${semilla}: con 2 turnos seguidos sin daño, el arma elegida (${decision.entrada.arma}) debía tener daño real`,
    );
  }
});
