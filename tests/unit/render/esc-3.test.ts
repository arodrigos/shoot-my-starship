import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";
import { ESCALA_DIBUJO_NAVE } from "@/sim/naves/geometriaCasco";

// esc-3: el casco de COLISIÓN (impacto-naves) no se mueve un píxel aunque el
// casco de DIBUJO se triplique -- es la promesa central de la opción B, y lo
// que hace seguro construir contacto-honesto encima sin volver a discutir
// este número.
test("esc-3: RADIO_CASCO_NAVE_PX sigue en 22px tras escalar el dibujo de la nave", () => {
  assert.equal(RADIO_CASCO_NAVE_PX, 22);
  assert.equal(ESCALA_DIBUJO_NAVE, 3.0);
});

// esc-3: impacto.ts (la física de colisión real) no depende en absoluto de
// geometriaCasco.ts (la silueta dibujada) -- si dependiera, escalar el
// dibujo podría arrastrar sin querer la física, exactamente lo que la
// opción B prohíbe.
test("esc-3: src/sim/naves/impacto.ts no importa la geometría de dibujo del casco", async () => {
  const contenido = await readFile(new URL("../../../src/sim/naves/impacto.ts", import.meta.url), "utf8");
  assert.doesNotMatch(contenido, /geometriaCasco/);
});
