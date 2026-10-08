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
// sin que nadie lo decidiera. Hash actualizado en potencia-dispersion: ese
// bloque SÍ mueve el balance a propósito (dispersión universal en
// avanzar()), así que el hash nuevo es el que fija ese bloque, no una
// regresión de este.
// Hash actualizado en armas-reprecio-roles: ese bloque SÍ mueve el balance a
// propósito (daño y radio del catálogo), así que el hash nuevo es el que
// fija ese bloque, no una regresión de este.
// Hash actualizado en siluetas-por-asiento (sil-2): el daño se mide contra la
// silueta visible (suelo del 20 % de daño al tocarla) en vez de al centro, lo que mueve el balance a propósito.
const HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE = "3b5687a0d64ea926160f03de2797748b0942473eda610074e70b45abe9c1b150";

test("esc-4: 200 partidas dan exactamente el mismo resultado que antes de escala-legible (el balance no se movió)", () => {
  const lote = jugarLote(20260929, 200);
  assert.equal(lote.length, 200);
  assert.equal(hashDeLote(lote), HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE);
});
