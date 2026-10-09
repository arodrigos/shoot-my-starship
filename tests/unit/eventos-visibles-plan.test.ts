import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CATALOGO_EVENTOS } from "@/sim/universo/catalogoEventos";
import { aplicarEvento, avanzarUniverso } from "@/sim/universo/efectos";
import type { TipoEvento } from "@/sim/universo/tipos";
import { DURACION_TRANSITORIO_MS, etiquetaDebug, planificarPersistentes } from "@/juego/efectos/eventos/planEventos";
import { estadoConUniverso } from "../utils/calendarioEventos";

const TIPOS = CATALOGO_EVENTOS.map((evento) => evento.tipo);

// evv-2 (invariante): para cualquier EstadoUniverso, lo que se enseña como
// persistente es exactamente lo que hay en efectos (mismo tipo y misma nave) y
// en objetos. Se generan estados reales aplicando secuencias de eventos y
// cierres de turno con el núcleo, no estados inventados.
test("evv-2: los efectos persistentes visibles son exactamente los de EstadoUniverso", () => {
  const paso = fc.oneof(
    fc.record({ cierre: fc.constant(true), tipo: fc.constantFrom(...TIPOS), afectado: fc.integer({ min: 0, max: 3 }) }),
    fc.record({ cierre: fc.constant(false), tipo: fc.constantFrom(...TIPOS), afectado: fc.integer({ min: 0, max: 3 }) }),
  );
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 0x7fffffff }), fc.array(paso, { minLength: 1, maxLength: 25 }), (semilla, pasos) => {
      let estado = estadoConUniverso(semilla, "presupuesto");
      for (const [i, p] of pasos.entries()) {
        estado = p.cierre
          ? avanzarUniverso(estado, { tirador: i % 4, armaGratis: false }).estado
          : aplicarEvento(estado, { enTurnos: 0, tipo: p.tipo, afectado: p.afectado }, "calendario").estado;
        const universo = estado.universo!;
        const plan = planificarPersistentes(universo);
        const delPlan = plan.filter((e) => e.objeto === undefined).map((e) => `${e.tipo}:${e.nave ?? "-"}`).sort();
        const delEstado = universo.efectos.map((e) => `${e.tipo}:${e.nave ?? "-"}`).sort();
        assert.deepEqual(delPlan, delEstado);
        const objetosPlan = plan.filter((e) => e.objeto !== undefined).map((e) => e.objeto).sort();
        assert.deepEqual(objetosPlan, (universo.objetos ?? []).map((o) => o.id).sort());
        assert.equal(new Set(plan.map((e) => e.clave)).size, plan.length, "las claves son únicas");
      }
    }),
    { numRuns: 50 },
  );
});

test("evv-1: cada uno de los 11 tipos tiene efecto gráfico, persistente o transitorio", () => {
  assert.equal(TIPOS.length, 11);
  for (const tipo of TIPOS) {
    const estado = aplicarEvento(estadoConUniverso(5, "presupuesto"), { enTurnos: 0, tipo, afectado: 1 }, "calendario").estado;
    const persistente = planificarPersistentes(estado.universo).some((e) => e.tipo === tipo);
    const transitorio = DURACION_TRANSITORIO_MS[tipo as TipoEvento] !== undefined;
    assert.ok(persistente !== transitorio, `${tipo}: o persiste en el estado o es transitorio, no ambos ni ninguno`);
    assert.equal(etiquetaDebug(tipo), `evento-${tipo}`);
  }
});

test("evv-1: los transitorios duran más de un segundo para que el e2e los vea", () => {
  for (const ms of Object.values(DURACION_TRANSITORIO_MS)) assert.ok((ms ?? 0) >= 1500);
});
