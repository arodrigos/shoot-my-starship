import { test } from "node:test";
import assert from "node:assert/strict";
import { jugarLote, hashDeLote } from "../../utils/loteAleatorio";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";

// vex-5: mismo hash que ya confirmaron esc-4 (escala-legible) y nve-2
// (naves-siluetas) para la misma semilla maestra y el mismo tamaño de lote --
// ninguna de las tres variantes nuevas de vuelo-extensible (erratico, mecha,
// adherente-con-mecha) la usa ningún arma del catálogo todavía, así que el
// lote determinista tiene que seguir dando exactamente lo mismo.
const HASH_LOTE_PREVIO_A_VUELO_EXTENSIBLE = "f808d6d33aa77d622aa063179efeb98dea2d343cbc64b43528466549468782b4";

test("vex-5: ningún arma del catálogo actual usa las variantes nuevas de comportamiento", () => {
  const tiposNuevos = new Set(["erratico", "mecha", "adherente-con-mecha"]);
  for (const arma of CATALOGO_ARMAS) {
    assert.equal(tiposNuevos.has(arma.comportamiento.tipo), false, `${arma.id} ya usa un comportamiento de vuelo-extensible`);
  }
});

test("vex-5: 200 partidas dan exactamente el mismo resultado que antes de vuelo-extensible", () => {
  const lote = jugarLote(20260929, 200);
  assert.equal(lote.length, 200);
  assert.equal(hashDeLote(lote), HASH_LOTE_PREVIO_A_VUELO_EXTENSIBLE);
});
