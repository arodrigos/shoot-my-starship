import { test } from "node:test";
import assert from "node:assert/strict";
import { jugarLote, hashDeLote } from "../../utils/loteAleatorio";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

// nve-2: naves-siluetas es puramente de dibujo (src/juego/naves/Nave.ts y
// formaCasco.ts, que no toca src/sim) -- el mismo hash que ya venía dando
// dev desde escala-legible (ver esc-4.test.ts) tiene que seguir siendo
// idéntico, porque nada de lo que cambia este bloque participa en la
// resolución de un disparo.
const HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE = "f808d6d33aa77d622aa063179efeb98dea2d343cbc64b43528466549468782b4";

test("nve-2: 200 partidas dan exactamente el mismo resultado que antes de naves-siluetas (el balance no se movió)", () => {
  const lote = jugarLote(20260929, 200);
  assert.equal(lote.length, 200);
  assert.equal(hashDeLote(lote), HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE);
});

test("nve-2: RADIO_CASCO_NAVE_PX sigue en 22px tras el rediseño de silueta", () => {
  assert.equal(RADIO_CASCO_NAVE_PX, 22);
});
