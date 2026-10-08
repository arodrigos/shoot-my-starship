import { test } from "node:test";
import assert from "node:assert/strict";
import { jugarLote, hashDeLote } from "../../utils/loteAleatorio";
import { RADIO_ENVOLVENTE_NAVE_PX, puntosCascoVariante } from "@/sim/naves/geometriaCasco";

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
// silueta visible (suelo del 20 % de daño al tocarla) en vez de al centro, lo que mueve el balance a propósito.
// Hash actualizado en salida-pantalla (el tiro que sale del encuadre se pierde) y en naves-silueta: la zona de impacto es la silueta (daño
// por distancia al polígono, sin el suelo del 20 %), lo que mueve el balance a propósito.
const HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE = "1245898a0fc80ca6f457e63ef98dc482bec82519d3183e9e6342e787412d5f17";

test("nve-2: 200 partidas dan exactamente el mismo resultado que antes de naves-siluetas (el balance no se movió)", () => {
  const lote = jugarLote(20260929, 200);
  assert.equal(lote.length, 200);
  assert.equal(hashDeLote(lote), HASH_LOTE_PREVIO_A_ESCALA_LEGIBLE);
});

test("nve-2: el círculo envolvente contiene todos los vértices de las cuatro siluetas", () => {
  for (const variante of [0, 1, 2, 3] as const) {
    for (const p of puntosCascoVariante(variante, 1)) {
      assert.ok(Math.hypot(p.x, p.y) <= RADIO_ENVOLVENTE_NAVE_PX);
    }
  }
});
