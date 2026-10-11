import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { PLANTILLAS_RESUMEN } from "@/contenido/resumenesPartida";
import {
  LONGITUD_MAXIMA_RESUMEN,
  MEMORIA_PLANTILLAS,
  resumenPartida,
  tocaResumen,
  type AsientoResumen,
} from "@/sim/partida/resumenPartida";

const asientoArb = fc.record({
  nombre: fc.oneof(fc.constantFrom("Chispa", "La Contable", "Almirante Bisagra", "Ana"), fc.string({ minLength: 1, maxLength: 30 }).filter((n) => n.trim() !== "")),
  integridad: fc.integer({ min: 0, max: 150 }),
  fallosSeguidos: fc.integer({ min: 0, max: 12 }),
  credito: fc.option(fc.integer({ min: 0, max: 600 }), { nil: undefined }),
  viva: fc.boolean(),
});
const asientosArb = fc.array(asientoArb, { minLength: 2, maxLength: 4 });

function lider(asientos: readonly AsientoResumen[]): { nombres: string[]; max: number } {
  const vivos = asientos.filter((a) => a.viva);
  const base = vivos.length > 0 ? vivos : asientos;
  const max = Math.max(...base.map((a) => a.integridad));
  return { nombres: base.filter((a) => a.integridad === max).map((a) => a.nombre), max };
}

test("res-v1: todas las plantillas caben en 140 caracteres con los nombres y números más largos", () => {
  const largo = "N".repeat(14);
  for (const plantillas of Object.values(PLANTILLAS_RESUMEN)) {
    assert.ok(plantillas.length >= 6);
    for (const plantilla of plantillas) {
      const texto = plantilla.replace(/\{(lider|otro)\}/g, largo).replace(/\{(\w+)\}/g, "150");
      assert.ok(texto.length <= LONGITUD_MAXIMA_RESUMEN, `${texto.length}: ${plantilla}`);
    }
  }
});

test("invariante: el resumen no está vacío, mide ≤ 140 y nombra al líder o dice «empate»", () => {
  fc.assert(
    fc.property(asientosArb, fc.integer({ min: 1, max: 30 }), fc.nat(1_000_000), (asientos, ronda, semilla) => {
      const { texto } = resumenPartida({ asientos, ronda, recientes: [] }, semilla);
      assert.ok(texto.length > 0 && texto.length <= LONGITUD_MAXIMA_RESUMEN, texto);
      const { nombres } = lider(asientos);
      if (nombres.length > 1) assert.match(texto, /empate/i);
      else assert.ok(texto.includes(nombres[0].trim().slice(0, 13)), `${texto} / ${nombres[0]}`);
    }),
    { numRuns: 500 },
  );
});

test("invariante: es determinista para el mismo estado y semilla", () => {
  fc.assert(
    fc.property(asientosArb, fc.nat(1_000_000), (asientos, semilla) => {
      const entrada = { asientos, ronda: 5, recientes: [] };
      assert.deepEqual(resumenPartida(entrada, semilla), resumenPartida(entrada, semilla));
    }),
  );
});

test("invariante: ninguna plantilla se repite en 5 resúmenes consecutivos", () => {
  fc.assert(
    fc.property(fc.array(asientosArb, { minLength: 6, maxLength: 30 }), fc.nat(1_000_000), (partida, semilla) => {
      const emitidas: string[] = [];
      partida.forEach((asientos, i) => {
        const { plantilla } = resumenPartida({ asientos, ronda: 1 + i, recientes: emitidas }, semilla + i);
        const previas = emitidas.slice(-MEMORIA_PLANTILLAS);
        assert.ok(!previas.includes(plantilla), `${plantilla} repetida en ${previas.join(",")}`);
        emitidas.push(plantilla);
      });
    }),
    { numRuns: 200 },
  );
});

test("invariante: para N turnos resueltos salen floor(N/3) resúmenes", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 200 }), (n) => {
      let salidos = 0;
      for (let turno = 1; turno <= n; turno++) if (tocaResumen(turno)) salidos += 1;
      assert.equal(salidos, Math.floor(n / 3));
    }),
  );
});

test("res-v1: con integridades [150, 120, 90] el líder es el primero; con empate en cabeza, «empate»", () => {
  const base = { fallosSeguidos: 0, viva: true };
  const claro = resumenPartida(
    { asientos: [{ nombre: "Ana", integridad: 150, ...base }, { nombre: "Luis", integridad: 120, ...base }, { nombre: "Eva", integridad: 90, ...base }], ronda: 1, recientes: [] },
    7,
  );
  assert.match(claro.texto, /Ana/);
  const empate = resumenPartida(
    { asientos: [{ nombre: "Ana", integridad: 100, ...base }, { nombre: "Luis", integridad: 100, ...base }], ronda: 1, recientes: [] },
    7,
  );
  assert.match(empate.texto, /empate/i);
});
