import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { MAPAS, MAPA_POR_DEFECTO, buscarMapa, elegirMapaDistinto } from "@/juego/mundos/mapas";

describe("mapas", () => {
  afterEach(() => mock.restoreAll());

  it("ids, semillas y etiquetas de deriva no se repiten entre mapas", () => {
    for (const campo of ["id", "semillaTerreno", "semillaPartida"] as const) {
      assert.equal(new Set(MAPAS.map((m) => m[campo])).size, MAPAS.length, campo);
    }
    assert.equal(new Set(MAPAS.map((m) => m.mundo.etiquetaDeriva)).size, MAPAS.length);
  });

  it("buscarMapa devuelve el mapa por id y lanza con un id desconocido", () => {
    for (const mapa of MAPAS) assert.equal(buscarMapa(mapa.id), mapa);
    assert.throws(() => buscarMapa("no-existe"), /no-existe/);
  });

  it("elegirMapaDistinto nunca repite el actual, con cualquier valor del azar", () => {
    for (const actual of MAPAS) {
      for (const r of [0, 0.25, 0.49, 0.5, 0.75, 0.999999]) {
        mock.method(Math, "random", () => r);
        const elegido = elegirMapaDistinto(actual.id);
        assert.notEqual(elegido.id, actual.id);
        mock.restoreAll();
      }
    }
  });

  it("elegirMapaDistinto reparte entre los otros dos según el azar", () => {
    mock.method(Math, "random", () => 0);
    assert.equal(elegirMapaDistinto(MAPAS[0].id), MAPAS[1]);
    mock.restoreAll();
    mock.method(Math, "random", () => 0.99);
    assert.equal(elegirMapaDistinto(MAPAS[0].id), MAPAS[2]);
  });

  it("con un id desconocido elige entre los tres", () => {
    mock.method(Math, "random", () => 0.99);
    assert.equal(elegirMapaDistinto("otro"), MAPAS[2]);
  });

  it("el mapa por defecto es el primero de la lista", () => {
    assert.equal(MAPA_POR_DEFECTO, MAPAS[0]);
  });
});
