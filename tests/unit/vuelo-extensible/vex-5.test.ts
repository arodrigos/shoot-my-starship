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
// el hash es la comprobación de fondo que de verdad sostiene vex-5. Hash
// actualizado en potencia-dispersion: ese bloque SÍ mueve el balance a
// propósito (dispersión universal en avanzar()), así que el hash nuevo es
// el que fija ese bloque, no una regresión de este.
// Hash actualizado en armas-reprecio-roles: ese bloque SÍ mueve el balance a
// propósito (daño y radio del catálogo), así que el hash nuevo es el que
// fija ese bloque, no una regresión de este.
// Hash actualizado en siluetas-por-asiento (sil-2): el daño se mide contra la
// silueta visible (suelo del 20 % de daño al tocarla) en vez de al centro, lo que mueve el balance a propósito.
const HASH_LOTE_PREVIO_A_VUELO_EXTENSIBLE = "1245898a0fc80ca6f457e63ef98dc482bec82519d3183e9e6342e787412d5f17";

test("vex-5: 200 partidas dan exactamente el mismo resultado que antes de vuelo-extensible", () => {
  const lote = jugarLote(20260929, 200);
  assert.equal(lote.length, 200);
  assert.equal(hashDeLote(lote), HASH_LOTE_PREVIO_A_VUELO_EXTENSIBLE);
});
