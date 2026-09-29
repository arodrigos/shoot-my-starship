import { test } from "node:test";
import assert from "node:assert/strict";
import { jugarLote, hashDeLote } from "../../utils/loteAleatorio";

// esc-4: escala-legible es un bloque puramente visual -- ESCALA_DIBUJO_NAVE,
// la derivación relativa del tamaño de proyectil y la opacidad del casco
// viven todas en src/juego, y lo único que se movió a src/sim
// (geometriaCasco.ts) no lo importa ni el motor ni el generador de terreno.
// Este hash es el mismo que produce dev HEAD (antes de este bloque) para la
// misma semilla maestra y el mismo tamaño de lote -- si cambiara, señalaría
// que "solo cambiamos el dibujo" era falso y el balance del juego se movió
// sin que nadie lo decidiera.
const HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE = "f808d6d33aa77d622aa063179efeb98dea2d343cbc64b43528466549468782b4";

test("esc-4: 200 partidas dan exactamente el mismo resultado que antes de escala-legible (el balance no se movió)", () => {
  const lote = jugarLote(20260929, 200);
  assert.equal(lote.length, 200);
  assert.equal(hashDeLote(lote), HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE);
});
