import { test } from "node:test";
import assert from "node:assert/strict";
import { jugarLote } from "../../utils/loteAleatorio";

test("nucleo-5: 500 partidas simuladas terminan todas con un ganador, sin bucles infinitos ni estados imposibles", () => {
  const lote = jugarLote(7182024, 500);

  const agotadas = lote.filter((r) => r.agotada).map((r) => r.semilla);
  const sinGanador = lote.filter((r) => r.ganador === null).map((r) => r.semilla);
  const conProblemas = lote.filter((r) => r.problemas.length > 0).map((r) => ({ semilla: r.semilla, problemas: r.problemas }));

  assert.deepEqual(agotadas, [], `partidas que no convergieron en el límite de turnos: ${agotadas.length}`);
  assert.deepEqual(sinGanador, [], `partidas sin ganador: ${sinGanador.length}`);
  assert.deepEqual(conProblemas, [], "partidas con estados imposibles (vida negativa, nave fuera del mapa, turno inconsistente)");
});
