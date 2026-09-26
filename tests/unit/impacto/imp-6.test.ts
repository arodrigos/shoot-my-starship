import { test } from "node:test";
import assert from "node:assert/strict";
import { cajaCasco } from "@/juego/naves/geometriaCasco";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

test("imp-6: el radio de casco físico está entre el 40% y el 60% de la dimensión menor de la silueta dibujada", () => {
  for (const dir of [1, -1] as const) {
    const caja = cajaCasco(dir);
    const dimensionMenor = Math.min(caja.ancho, caja.alto);
    const fraccion = RADIO_CASCO_NAVE_PX / dimensionMenor;

    assert.ok(
      fraccion >= 0.4 && fraccion <= 0.6,
      `dir=${dir}: RADIO_CASCO_NAVE_PX (${RADIO_CASCO_NAVE_PX}px) es el ${(fraccion * 100).toFixed(1)}% de la dimensión menor dibujada (${dimensionMenor.toFixed(1)}px), fuera de [40%,60%]`,
    );
  }
});
