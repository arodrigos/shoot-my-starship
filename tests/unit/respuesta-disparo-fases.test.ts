import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import fc from "fast-check";
import { avanzar, cerrarTurnoTrasImpacto, contadoresDeCalculo, reiniciarContadoresDeCalculo, resolverImpacto } from "@/sim/partida/avanzar";
import { serializarEstado } from "@/sim/partida/serializacion";
import { casoDeSemilla, huellaDeTurno, huellasDePartidaGuionizada } from "../utils/casosEquivalenciaTurno";

// Golden tomado con el avanzar() de antes de partir el turno (commit de
// bug-movimiento-naves): hash por semilla y hash por turno de una partida.
const golden = JSON.parse(readFileSync(new URL("./golden/turno-partido.json", `file://${__dirname}/`), "utf8")) as {
  casos: Record<string, string>;
  partida: string[];
};

function enDosFases(estado: Parameters<typeof avanzar>[0], entrada: Parameters<typeof avanzar>[1]) {
  // structuredClone en medio: es lo que hace el trabajador, y prueba que la
  // fase es dato plano completo (no arrastra nada por referencia).
  return cerrarTurnoTrasImpacto(structuredClone(resolverImpacto(estado, entrada)));
}

test("rsp-2: avanzar() y las dos fases dan el golden de 200 semillas", () => {
  for (let semilla = 1; semilla <= 200; semilla++) {
    const { estado, entrada } = casoDeSemilla(semilla);
    assert.equal(huellaDeTurno(estado, entrada), golden.casos[semilla], `avanzar semilla ${semilla}`);
  }
});

test("rsp-2: la composición de las dos fases, tras un structuredClone, da lo mismo que avanzar()", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 200 }), (semilla) => {
      const { estado, entrada } = casoDeSemilla(semilla);
      assert.equal(huellaDeTurno(estado, entrada, enDosFases), golden.casos[semilla]);
    }),
    { numRuns: 25, seed: 7 },
  );
});

test("rsp-2: 30 turnos guionizados dan el hash del golden turno a turno", () => {
  const huellas = huellasDePartidaGuionizada(1, 30);
  assert.equal(huellas.length, 30);
  assert.deepEqual(huellas, golden.partida);
});

test("rsp-1: resolverImpacto simula como mucho 2 vuelos de disparo y ninguna búsqueda de tiro viable", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 200 }), (semilla) => {
      const { estado, entrada } = casoDeSemilla(semilla);
      reiniciarContadoresDeCalculo();
      try {
        resolverImpacto(estado, entrada);
      } catch {
        // Un turno rechazado tampoco calcula de más.
      }
      assert.ok(contadoresDeCalculo.resolverDisparo <= 2, `resolverDisparo ${contadoresDeCalculo.resolverDisparo}`);
      assert.equal(contadoresDeCalculo.existeTiroViable, 0);
    }),
    { numRuns: 25, seed: 11 },
  );
});

test("rsp-2: ninguna de las dos fases muta lo que recibe", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 200 }), (semilla) => {
      const { estado, entrada } = casoDeSemilla(semilla);
      const antes = serializarEstado(estado);
      let fase;
      try {
        fase = resolverImpacto(estado, entrada);
      } catch {
        assert.equal(serializarEstado(estado), antes);
        return;
      }
      assert.equal(serializarEstado(estado), antes);
      const faseAntes = JSON.stringify(fase, (_k, v: unknown) => (v instanceof Uint8Array ? Array.from(v) : v));
      cerrarTurnoTrasImpacto(fase);
      assert.equal(JSON.stringify(fase, (_k, v: unknown) => (v instanceof Uint8Array ? Array.from(v) : v)), faseAntes);
    }),
    { numRuns: 25, seed: 13 },
  );
});

test("rsp-2: la caché de viabilidad no cambia el resultado del cierre", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 200 }), (semilla) => {
      const { estado, entrada } = casoDeSemilla(semilla);
      let fase;
      try {
        fase = resolverImpacto(estado, entrada);
      } catch {
        return;
      }
      const con = cerrarTurnoTrasImpacto(fase);
      const sin = cerrarTurnoTrasImpacto(fase, { sinCacheDeViabilidad: true });
      assert.equal(serializarEstado(con.estado), serializarEstado(sin.estado));
      assert.deepEqual(con.eventos, sin.eventos);
    }),
    { numRuns: 25, seed: 17 },
  );
});

test("rsp-2: un turno que termina la partida en la fase de impacto cierra sin tocar robots ni universo", () => {
  const { estado, entrada } = casoDeSemilla(4);
  const casi = { ...estado, naves: estado.naves.map((nave, id) => (id === entrada.objetivoId ? { ...nave, integridad: 1 } : { ...nave, integridad: id === estado.turno ? 100 : nave.integridad })) };
  const letal = { ...entrada, accion: "disparo" as const };
  const fase = resolverImpacto(casi, letal);
  const cierre = cerrarTurnoTrasImpacto(fase);
  assert.deepEqual(cierre.estado, avanzar(casi, letal).estado);
});

test("rsp-2: el turno de escudo no tiene resultado de disparo en la fase de impacto", () => {
  const { estado, entrada } = casoDeSemilla(2);
  const fase = resolverImpacto(estado, { ...entrada, accion: "escudo" });
  assert.equal(fase.resultadoDisparo, null);
  assert.equal(fase.objetivoId, null);
  assert.equal(fase.accion, "escudo");
});
