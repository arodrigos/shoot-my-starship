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
