import { test } from "node:test";
import assert from "node:assert/strict";
import { jugarLote, hashDeLote } from "../../utils/loteAleatorio";

// vex-5: mismo hash que ya confirmaron esc-4 (escala-legible) y nve-2
// (naves-siluetas) para la misma semilla maestra y el mismo tamaño de lote --
// el criterio real es que las armas YA EXISTENTES en el momento de
// vuelo-extensible no cambian de trayectoria ni de resultado, no que ningún
// arma futura llegue a usar las variantes nuevas: arma-mosca ya cablea
// "erratico" en mosca-cojonera a propósito, así que esa comprobación (que
// aquí vivía como un segundo test) queda obsoleta por diseño y se retira;
// el hash es la comprobación de fondo que de verdad sostiene vex-5.
const HASH_LOTE_PREVIO_A_VUELO_EXTENSIBLE = "f808d6d33aa77d622aa063179efeb98dea2d343cbc64b43528466549468782b4";

test("vex-5: 200 partidas dan exactamente el mismo resultado que antes de vuelo-extensible", () => {
  const lote = jugarLote(20260929, 200);
  assert.equal(lote.length, 200);
  assert.equal(hashDeLote(lote), HASH_LOTE_PREVIO_A_VUELO_EXTENSIBLE);
});
