import test from "node:test";
import assert from "node:assert/strict";
import { resumenTurno } from "@/juego/escenas/resumenTurno";
import type { EventoSimulacion } from "@/sim/partida/eventos";

// vis-1: el bocadillo no puede decir a la vez «sin hacer daño» y «salió
// despedida» cuando el empuje es el del minirobot sobre otra nave.
test("vis-1: con impactoNave, solo el desplazamiento de esa nave cuenta como «despedida»", () => {
  const eventos = [
    { tipo: "impacto", x: 10, y: 10, objetivo: 1, danio: 0, impactoNave: 1 },
    { tipo: "robot-detona", nave: 0, objetivo: 2, x: 50, y: 50, danio: 40 },
    { tipo: "desplazamiento", nave: 2, reserva: "se-mueve" },
  ] as unknown as EventoSimulacion[];
  const texto = resumenTurno(eventos);
  assert.ok(texto.includes("sin hacer daño"));
  assert.ok(!texto.includes("salió despedida"));
  assert.ok(texto.includes("El minirobot ha saltado encima"));
});

// vis-1: si el disparo falla o se pierde y el robot detona en el mismo turno,
// el bocadillo cuenta el daño del robot en vez de decir que no hubo daño.
for (const [nombre, evento] of [
  ["arma-falla", { tipo: "arma-falla" }],
  ["proyectil-perdido por el borde", { tipo: "proyectil-perdido", salida: true }],
  ["proyectil-perdido en órbita", { tipo: "proyectil-perdido", salida: false }],
] as const) {
  test(`vis-1: ${nombre} con robot-detona cuenta los 40 de daño del robot`, () => {
    const eventos = [evento, { tipo: "robot-detona", nave: 0, objetivo: 2, x: 50, y: 50, danio: 40 }] as unknown as EventoSimulacion[];
    const texto = resumenTurno(eventos);
    assert.ok(texto.includes("El minirobot ha saltado encima y explota: 40 de daño."), texto);
  });
}

test("vis-1: un disparo fallido sin robot sigue sin mencionarlo", () => {
  const texto = resumenTurno([{ tipo: "arma-falla" }] as unknown as EventoSimulacion[]);
  assert.ok(!texto.includes("minirobot"));
});
