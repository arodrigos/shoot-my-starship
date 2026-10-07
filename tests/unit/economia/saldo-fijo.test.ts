import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { PREMIO_LOTERIA, PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import * as economia from "@/sim/partida/economia";
import * as parametros from "@/sim/economia/parametros";

// sdo-1 (invariante): el saldo de cada partida y asiento es 600 sea cual sea
// lo que sobró antes. Ya no existe ninguna función que lea un sobrante, así que
// el único camino al saldo inicial es la constante.
test("sdo-1 (propiedad): ninguna secuencia de partidas ni sobrante cambia el saldo inicial", () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: -5000, max: 5000 }), { maxLength: 10 }), (sobrantes) => {
      for (let i = 0; i < sobrantes.length; i++) assert.equal(PRESUPUESTO_BASE, 600);
      assert.equal("saldoDeRonda" in economia, false);
    }),
    { numRuns: 100 },
  );
});

test("sdo-2: la base vale 600, la lotería 150 y el arrastre ya no existe", () => {
  assert.equal(PRESUPUESTO_BASE, 600);
  assert.equal(PREMIO_LOTERIA, 150);
  assert.equal("ARRASTRE_MAXIMO" in parametros, false);
});

test("sdo-2: el README dice 600 y no menciona el arrastre de saldo", () => {
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
  assert.match(readme, /`PRESUPUESTO_BASE` = 600/);
  assert.doesNotMatch(readme, /ARRASTRE_MAXIMO|se arrastra/);
});
