import { test } from "node:test";
import assert from "node:assert/strict";
import { cajaCasco } from "@/sim/naves/geometriaCasco";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

// escala-legible (opción B de Adrián) rompe a propósito la proporción que
// este test comprobaba antes: el casco de colisión se queda fijo en 22px
// mientras la silueta dibujada crece con ESCALA_DIBUJO_NAVE, así que la
// fracción baja de ~50% a ~17% -- es exactamente el precio de la opción B,
// pagado en el bloque contacto-honesto (núcleo visible + roce anunciado).
// Lo que este test sigue comprobando es que el casco NO ha crecido con el
// dibujo: sigue siendo una fracción pequeña y estable de la silueta.
test("imp-6: el radio de casco físico es mucho menor que la silueta dibujada (opción B: el dibujo miente, el casco no crece)", () => {
  for (const dir of [1, -1] as const) {
    const caja = cajaCasco(dir);
    const dimensionMenor = Math.min(caja.ancho, caja.alto);
    const fraccion = RADIO_CASCO_NAVE_PX / dimensionMenor;

    assert.ok(
      fraccion > 0 && fraccion <= 0.3,
      `dir=${dir}: RADIO_CASCO_NAVE_PX (${RADIO_CASCO_NAVE_PX}px) es el ${(fraccion * 100).toFixed(1)}% de la dimensión menor dibujada (${dimensionMenor.toFixed(1)}px), debería quedarse por debajo del 30% desde escala-legible`,
    );
  }
});
