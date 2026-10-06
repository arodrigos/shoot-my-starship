import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { ALMIRANTE_BISAGRA } from "@/sim/ia/personalidades";
import { avanzar } from "@/sim/partida/avanzar";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { crearMascaraVacia } from "@/sim/terreno/mascara";

const MUNDO: ParametrosMundo = { ancho: 1046, alto: 1859, gravedad: 1, deriva: 0, etiquetaDeriva: "" };

function estadoIA(integridad: number, saldo: number): EstadoPartida {
  return {
    version: 1,
    mundo: MUNDO,
    mascara: crearMascaraVacia(MUNDO.ancho, MUNDO.alto),
    naves: [
      { x: 200, y: 600, integridad: 100 },
      { x: 800, y: 1300, integridad },
    ],
    ordenTurno: [0, 1],
    turno: 1,
    numeroTurno: 1,
    aleatorio: crearEstadoAleatorio(3),
    resultado: { tipo: "en-curso" },
    modo: "presupuesto",
    saldos: [850, saldo],
  };
}

// esc-3: criterio de la IA, sobre la fuente real y el avanzar() real.
test("esc-3: con saldo 850, integridad 40 y daño recibido, la IA elige el escudo y paga 90", () => {
  const { entrada, estado } = crearFuenteIA(ALMIRANTE_BISAGRA, null, {}, true)(estadoIA(40, 850));
  assert.equal(entrada.accion, "escudo");
  assert.equal(avanzar(estado, entrada).estado.saldos?.[1], 760);
});

test("esc-3: con integridad 80 no lo elige", () => {
  const { entrada } = crearFuenteIA(ALMIRANTE_BISAGRA, null, {}, true)(estadoIA(80, 850));
  assert.notEqual(entrada.accion, "escudo");
});

test("esc-3: con integridad 40 y saldo 80 tampoco: dispara", () => {
  const { entrada } = crearFuenteIA(ALMIRANTE_BISAGRA, null, {}, true)(estadoIA(40, 80));
  assert.ok(entrada.accion === undefined || entrada.accion === "disparo");
});

test("esc-3: sin daño reciente no se protege", () => {
  const { entrada } = crearFuenteIA(ALMIRANTE_BISAGRA, null, {}, false)(estadoIA(40, 850));
  assert.notEqual(entrada.accion, "escudo");
});
