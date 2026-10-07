import { test } from "node:test";
import assert from "node:assert/strict";
import { jugarLote, hashDeLote } from "../../utils/loteAleatorio";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

// nve-2: naves-siluetas es puramente de dibujo (src/juego/naves/Nave.ts y
// formaCasco.ts, que no toca src/sim) -- el mismo hash que ya venía dando
// dev desde escala-legible (ver esc-4.test.ts) tiene que seguir siendo
// idéntico, porque nada de lo que cambia este bloque participa en la
// resolución de un disparo. Hash actualizado en potencia-dispersion: ese
// bloque SÍ cambia la resolución de un disparo a propósito (dispersión
// universal en avanzar()), así que el balance se movió de verdad y el
// nuevo hash es el que fija ese bloque (ver esc-4.test.ts y vex-5.test.ts).
// Hash actualizado en armas-reprecio-roles: ese bloque SÍ mueve el balance a
// propósito (daño y radio del catálogo), así que el hash nuevo es el que
// fija ese bloque, no una regresión de este.
// Hash actualizado en siluetas-por-asiento (sil-2): el daño se mide contra la
// silueta visible y no contra el centro, lo que mueve el balance a propósito.
const HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE = "b84a253506480b822b6587d02bd64cea401cb7e2fa17e54a54bcd363128f1574";

test("nve-2: 200 partidas dan exactamente el mismo resultado que antes de naves-siluetas (el balance no se movió)", () => {
  const lote = jugarLote(20260929, 200);
  assert.equal(lote.length, 200);
  assert.equal(hashDeLote(lote), HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE);
});

test("nve-2: RADIO_CASCO_NAVE_PX sigue en 22px tras el rediseño de silueta", () => {
  assert.equal(RADIO_CASCO_NAVE_PX, 22);
});
