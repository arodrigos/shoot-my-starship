import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { colocarNaves } from "@/sim/naves/colocacion";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { INTERVALO_MAXIMO_TURNOS, INTERVALO_MINIMO_TURNOS } from "@/sim/universo/calendario";
import { avanzarUniverso, conUniverso } from "@/sim/universo/efectos";
import { MUNDO_ALTO, MUNDO_ANCHO } from "./sistemaGenerado";

// Semillas del test rápido de evt-1. El lote largo (1000) lo corre
// scripts/medir-eventos.ts con PRUEBA_LARGA=1.
export const NUM_SEMILLAS_EVT_1_RAPIDO = 50;
export const NUM_SEMILLAS_EVT_1_LARGO = 1000;

const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 0, deriva: 0, etiquetaDeriva: "" };
const SEMILLA_SISTEMA = 31;

export function estadoConUniverso(semilla: number, modo: "barra-libre" | "presupuesto"): EstadoPartida {
  const colocacion = colocarNaves(SEMILLA_SISTEMA, MUNDO, crearEstadoAleatorio(SEMILLA_SISTEMA), 4, [false, false, false, false]);
  return conUniverso({
    version: 1,
    mundo: MUNDO,
    mascara: { ...colocacion.sistema.mascara, datos: colocacion.sistema.mascara.datos.slice() },
    naves: colocacion.naves,
    ordenTurno: [0, 1, 2, 3],
    turno: 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(semilla),
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
    modo,
    ...(modo === "presupuesto" ? { saldos: [PRESUPUESTO_BASE, PRESUPUESTO_BASE, PRESUPUESTO_BASE, PRESUPUESTO_BASE] } : {}),
  });
}

export function comprobarCalendarioDeEventos(numRuns: number): void {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 0x7fffffff }), fc.boolean(), (semilla, gratis) => {
      let estado = estadoConUniverso(semilla, "presupuesto");
      const primero = estado.universo!.proximo.enTurnos;
      assert.ok(primero >= INTERVALO_MINIMO_TURNOS && primero <= INTERVALO_MAXIMO_TURNOS);
      let ultimoEvento = 0;
      for (let turno = 1; turno <= 60; turno++) {
        const anunciado = estado.universo!.proximo;
        const resultado = avanzarUniverso(estado, { tirador: (turno - 1) % 4, armaGratis: gratis });
        const delCalendario = resultado.eventos.filter((evento) => evento.tipo === "evento-universo" && evento.origen === "calendario");
        if (anunciado.enTurnos === 1) {
          assert.equal(delCalendario.length, 1, "con enTurnos=1 el evento llega ya");
          const ocurrido = delCalendario[0];
          assert.ok(ocurrido.tipo === "evento-universo");
          assert.equal(ocurrido.evento, anunciado.tipo);
          assert.equal(ocurrido.nave, anunciado.afectado);
          assert.ok(turno - ultimoEvento >= INTERVALO_MINIMO_TURNOS && turno - ultimoEvento <= INTERVALO_MAXIMO_TURNOS, `hueco ${turno - ultimoEvento}`);
          ultimoEvento = turno;
        } else {
          assert.equal(delCalendario.length, 0);
        }
        estado = resultado.estado;
      }
    }),
    { numRuns },
  );
}
