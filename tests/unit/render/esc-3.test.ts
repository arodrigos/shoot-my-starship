import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ESCALA_DIBUJO_NAVE, RADIO_ENVOLVENTE_NAVE_PX } from "@/sim/naves/geometriaCasco";

// esc-3 (naves-silueta): la escala del dibujo es 1,5 y la zona de impacto es
// la propia silueta, así que ya no hay un casco de colisión independiente que
// deba quedarse fijo: lo que se comprueba es la escala vigente.
test("esc-3: ESCALA_DIBUJO_NAVE es 1,5 (la mitad que antes) y el círculo envolvente la sigue", () => {
  assert.equal(ESCALA_DIBUJO_NAVE, 1.5);
  assert.ok(RADIO_ENVOLVENTE_NAVE_PX > 0 && RADIO_ENVOLVENTE_NAVE_PX < 60);
});

// esc-3: impacto.ts (la física de colisión real) no depende en absoluto de
// geometriaCasco.ts (la silueta dibujada) -- si dependiera, escalar el
// dibujo podría arrastrar sin querer la física, exactamente lo que la
// opción B prohíbe.
test("esc-3: src/sim/naves/impacto.ts no importa la geometría de dibujo del casco", async () => {
  const contenido = await readFile(new URL("../../../src/sim/naves/impacto.ts", import.meta.url), "utf8");
  assert.doesNotMatch(contenido, /geometriaCasco/);
});
