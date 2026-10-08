import { test } from "node:test";
import assert from "node:assert/strict";
import { RADIO_ENVOLVENTE_NAVE_PX, puntosCascoVariante } from "@/sim/naves/geometriaCasco";

function area(puntos: readonly { x: number; y: number }[]): number {
  let suma = 0;
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i]!;
    const b = puntos[(i + 1) % puntos.length]!;
    suma += a.x * b.y - b.x * a.y;
  }
  return Math.abs(suma) / 2;
}

// naves-silueta: el círculo envolvente solo es un descarte rápido; la zona de
// impacto es el polígono, que ocupa bastante menos que ese disco.
test("imp-6: la zona de impacto (polígono) es menor que el círculo envolvente en las cuatro siluetas", () => {
  const disco = Math.PI * RADIO_ENVOLVENTE_NAVE_PX ** 2;
  for (const variante of [0, 1, 2, 3] as const) {
    for (const dir of [1, -1] as const) {
      const fraccion = area(puntosCascoVariante(variante, dir)) / disco;
      assert.ok(fraccion > 0 && fraccion < 0.6, `variante ${variante} dir ${dir}: el polígono ocupa el ${(fraccion * 100).toFixed(1)}% del disco`);
    }
  }
});
