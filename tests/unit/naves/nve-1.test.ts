import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPuntos, nivelDanio, puntosCascoConDanio } from "@/juego/naves/formaCasco";
import { cajaCasco } from "@/sim/naves/geometriaCasco";

// nve-1: los tres tramos de daño dan tres siluetas distintas (hash distinto
// dos a dos), en las dos orientaciones -- la parte determinista de "la
// silueta cambia de forma perceptible" que no depende de Phaser ni de un
// canvas real. El e2e (nve-1.e2e.ts) fuerza la integridad en el juego real
// y compara estos mismos hashes desde window.__debug.
test("nve-1: alta, media y baja producen hashes de silueta distintos en las dos direcciones", () => {
  for (const dir of [1, -1] as const) {
    const hashes = (["alta", "media", "baja"] as const).map((nivel) => hashPuntos(puntosCascoConDanio(dir, nivel)));
    const unicos = new Set(hashes);
    assert.equal(unicos.size, 3, `dir=${dir}: se esperaban 3 hashes distintos, hubo ${unicos.size} (${hashes.join(",")})`);
  }
});

test("nve-1: nivelDanio corta en alta (>66), media (34-66) y baja (<=33)", () => {
  assert.equal(nivelDanio(100), "alta");
  assert.equal(nivelDanio(67), "alta");
  assert.equal(nivelDanio(66), "media");
  assert.equal(nivelDanio(34), "media");
  assert.equal(nivelDanio(33), "baja");
  assert.equal(nivelDanio(0), "baja");
});

// nve-1 (verificación secundaria del criterio): el hash es una función pura
// de los puntos, no del estado interno de una instancia -- misma entrada,
// mismo hash, siempre.
test("nve-1: hashPuntos es determinista", () => {
  const puntos = puntosCascoConDanio(1, "media");
  assert.equal(hashPuntos(puntos), hashPuntos(puntosCascoConDanio(1, "media")));
});

// nve-2: las abolladuras insertan vértices SIN mover los cinco originales,
// así que la caja delimitadora que usan esc-1/esc-2/esc-6 para derivar el
// tamaño legible de la nave y el suelo del proyectil no se mueve ni un
// píxel con el daño.
test("nve-2: la caja delimitadora de la silueta no cambia con el tramo de daño", () => {
  for (const dir of [1, -1] as const) {
    const cajaBase = cajaCasco(dir);
    for (const nivel of ["alta", "media", "baja"] as const) {
      const puntos = puntosCascoConDanio(dir, nivel);
      const xs = puntos.map((p) => p.x);
      const ys = puntos.map((p) => p.y);
      const ancho = Math.max(...xs) - Math.min(...xs);
      const alto = Math.max(...ys) - Math.min(...ys);
      // Las abolladuras son cóncavas (empujan hacia el centro): la caja
      // delimitadora de una silueta dañada nunca puede ser MAYOR que la
      // intacta, solo igual (los vértices originales siguen marcando los
      // extremos).
      assert.ok(ancho <= cajaBase.ancho + 1e-9, `dir=${dir} nivel=${nivel}: ancho ${ancho} > caja base ${cajaBase.ancho}`);
      assert.ok(alto <= cajaBase.alto + 1e-9, `dir=${dir} nivel=${nivel}: alto ${alto} > caja base ${cajaBase.alto}`);
    }
  }
});
