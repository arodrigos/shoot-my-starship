import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clasificarVueloPropulsores,
  DISTANCIA_MINIMA_PROPULSORES,
  LARGO_NAVE_U,
} from "@/juego/control/vueloPropulsores";
import {
  obtenerEstadoControl,
  publicarJugable,
  publicarVueloPropulsores,
  registrarManejadorDisparo,
  reiniciarControl,
  seleccionarEquipo,
  solicitarDisparo,
} from "@/juego/control/store";

// El aviso solo tiene sentido si el largo de la nave queda por encima del
// umbral de bloqueo: si no, nunca habría un tramo "avisa y deja lanzar".
test("vuelo-corto: el largo de la nave supera el umbral de bloqueo de 12 u", () => {
  assert.equal(DISTANCIA_MINIMA_PROPULSORES, 12);
  assert.ok(LARGO_NAVE_U > DISTANCIA_MINIMA_PROPULSORES, `largo ${LARGO_NAVE_U}`);
});

test("vuelo-corto: por debajo de 12 u contra un obstáculo bloquea como antes", () => {
  for (const d of [0, 5, 11.99]) assert.equal(clasificarVueloPropulsores("obstaculo", d), "bloqueado", `d=${d}`);
});

test("vuelo-corto: entre 12 u y el largo de la nave avisa sin bloquear", () => {
  const medio = (DISTANCIA_MINIMA_PROPULSORES + LARGO_NAVE_U) / 2;
  for (const d of [12, 15, medio, LARGO_NAVE_U - 0.01]) {
    assert.equal(clasificarVueloPropulsores("obstaculo", d), "corto", `d=${d}`);
  }
});

test("vuelo-corto: exactamente el largo de la nave avisa", () => {
  for (const motivo of ["obstaculo", "alcance", "tiempo"] as const) {
    assert.equal(clasificarVueloPropulsores(motivo, LARGO_NAVE_U), "corto", motivo);
  }
});

test("vuelo-corto: por encima del largo de la nave ni aviso ni bloqueo", () => {
  for (const motivo of ["obstaculo", "alcance", "tiempo"] as const) {
    for (const d of [LARGO_NAVE_U + 0.01, LARGO_NAVE_U * 2, 500]) {
      assert.equal(clasificarVueloPropulsores(motivo, d), "normal", `${motivo} d=${d}`);
    }
  }
});

// Sin choque no hay bloqueo, aunque el vuelo sea mínimo: es el mismo criterio
// que ya aplicaba la escena antes de este aviso.
test("vuelo-corto: un vuelo mínimo sin obstáculo avisa pero no bloquea", () => {
  assert.equal(clasificarVueloPropulsores("tiempo", 3), "corto");
});

function lanzamientosTras(clase: "bloqueado" | "corto" | "normal"): number {
  reiniciarControl();
  publicarJugable(true);
  seleccionarEquipo("propulsores");
  let lanzamientos = 0;
  const quitar = registrarManejadorDisparo(() => {
    lanzamientos++;
  });
  publicarVueloPropulsores(clase);
  solicitarDisparo();
  quitar();
  return lanzamientos;
}

test("vuelo-corto: el store avisa del vuelo corto y aun así deja lanzar", () => {
  reiniciarControl();
  publicarVueloPropulsores("corto");
  assert.equal(obtenerEstadoControl().propulsoresVueloCorto, true);
  assert.equal(obtenerEstadoControl().propulsoresBloqueados, false);
  assert.equal(lanzamientosTras("corto"), 1);
});

test("vuelo-corto: el store sigue sin dejar lanzar un vuelo bloqueado", () => {
  reiniciarControl();
  publicarVueloPropulsores("bloqueado");
  assert.equal(obtenerEstadoControl().propulsoresBloqueados, true);
  assert.equal(obtenerEstadoControl().propulsoresVueloCorto, false);
  assert.equal(lanzamientosTras("bloqueado"), 0);
});

test("vuelo-corto: un vuelo normal ni avisa ni bloquea", () => {
  reiniciarControl();
  publicarVueloPropulsores("normal");
  assert.equal(obtenerEstadoControl().propulsoresVueloCorto, false);
  assert.equal(obtenerEstadoControl().propulsoresBloqueados, false);
  assert.equal(lanzamientosTras("normal"), 1);
});
