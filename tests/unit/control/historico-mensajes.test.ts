import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  contarMensajes,
  inyectarHistorico,
  obtenerBromas,
  publicarBromaDisparo,
  publicarBromaImpacto,
  reiniciarBromas,
  type EntradaHistoricoBroma,
} from "@/juego/control/broma";

const entradaArb = fc.record({
  numeroTurno: fc.nat(500),
  emisor: fc.integer({ min: 0, max: 3 }),
  disparo: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  impacto: fc.string({ minLength: 1 }),
  categoriaImpacto: fc.constant("acierto" as EntradaHistoricoBroma["categoriaImpacto"]),
});

test("his-1: el contador del botón es disparos + impactos de cualquier histórico", () => {
  fc.assert(
    fc.property(fc.array(entradaArb, { maxLength: 40 }), (entradas) => {
      const esperado = entradas.length + entradas.filter((e) => e.disparo !== null).length;
      assert.equal(contarMensajes(entradas), esperado);
    }),
  );
});

test("his-1: la entrada guarda el emisor del tirador y reiniciar vacía el histórico", () => {
  reiniciarBromas();
  publicarBromaDisparo(3, "¡Toma!");
  publicarBromaImpacto(3, "Ay.", "acierto" as EntradaHistoricoBroma["categoriaImpacto"], 1);
  const [entrada] = obtenerBromas().historico;
  assert.equal(entrada.emisor, 1);
  assert.equal(entrada.disparo, "¡Toma!");
  inyectarHistorico([]);
  assert.equal(obtenerBromas().historico.length, 0);
  reiniciarBromas();
});
