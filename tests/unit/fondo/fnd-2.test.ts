import { test } from "node:test";
import assert from "node:assert/strict";
import { generarEstrellasCercanas } from "@/juego/fondo/CapaEstelarCercana";

// fnd-2: la capa cercana del paralaje tiene que ser tan determinista como el
// resto del juego (issue "sin Math.random") -- misma semilla, mismo cielo,
// siempre, para que una partida grabada se pueda reproducir pixel a pixel.
test("fnd-2: generarEstrellasCercanas es determinista para una misma semilla", () => {
  const a = generarEstrellasCercanas(12345, 1920, 1080);
  const b = generarEstrellasCercanas(12345, 1920, 1080);
  assert.deepEqual(a, b);
});

test("fnd-2: dos semillas distintas producen cielos distintos", () => {
  const a = generarEstrellasCercanas(1, 1920, 1080);
  const b = generarEstrellasCercanas(2, 1920, 1080);
  assert.notDeepEqual(a, b);
});

test("fnd-2: todas las estrellas caen dentro del lienzo declarado", () => {
  const ancho = 1920;
  const alto = 1080;
  const estrellas = generarEstrellasCercanas(777, ancho, alto);
  assert.ok(estrellas.length > 0);
  for (const estrella of estrellas) {
    assert.ok(estrella.x >= 0 && estrella.x <= ancho, `x ${estrella.x} fuera de [0, ${ancho}]`);
    assert.ok(estrella.y >= 0 && estrella.y <= alto, `y ${estrella.y} fuera de [0, ${alto}]`);
    assert.ok(estrella.radio > 0);
    assert.ok(estrella.brillo > 0 && estrella.brillo <= 1);
  }
});
