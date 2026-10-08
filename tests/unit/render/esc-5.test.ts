import { test } from "node:test";
import assert from "node:assert/strict";
import { opacidadEnPunto, OPACIDAD_CASCO } from "@/juego/naves/opacidadCasco";
import { RADIO_ENVOLVENTE_NAVE_PX, puntosCascoVariante } from "@/sim/naves/geometriaCasco";
import { dentroDelPoligono } from "@/sim/naves/contacto";

// esc-5 (naves-silueta): la silueta es la zona de impacto, así que no hay
// zona "decorativa" más tenue: dentro del polígono la nave es opaca y fuera
// no se pinta nada, en las cuatro variantes y ambos sentidos.
test("esc-5: dentro de la silueta la nave es opaca y fuera no se pinta nada", () => {
  for (const variante of [0, 1, 2, 3] as const) {
    for (const dir of [1, -1] as const) {
      const poligono = puntosCascoVariante(variante, dir);
      for (let x = -RADIO_ENVOLVENTE_NAVE_PX; x <= RADIO_ENVOLVENTE_NAVE_PX; x += 2) {
        for (let y = -RADIO_ENVOLVENTE_NAVE_PX; y <= RADIO_ENVOLVENTE_NAVE_PX; y += 2) {
          const esperado = dentroDelPoligono(x, y, poligono) ? OPACIDAD_CASCO : 0;
          assert.equal(opacidadEnPunto(x, y, dir, variante), esperado, `variante ${variante} dir ${dir} (${x}, ${y})`);
        }
      }
    }
  }
});
