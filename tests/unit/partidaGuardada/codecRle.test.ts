import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { codificarRle, decodificarRle } from "@/juego/partidaGuardada/codecRle";
import { generarSistema } from "@/sim/sistema/generador";

describe("pgn-1: códec RLE de la máscara", () => {
  it("invariante: decodificar(codificar(m)) es idéntico a m, con rachas de todo tipo", () => {
    const rachas = fc.array(fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 1, max: 300 })), { maxLength: 40 });
    const desdeRachas = rachas.map((r) => Uint8Array.from(r.flatMap(([valor, veces]) => Array<number>(veces).fill(valor))));
    fc.assert(
      fc.property(fc.oneof(fc.uint8Array({ maxLength: 500 }), desdeRachas), (m) => {
        const vuelta = decodificarRle(codificarRle(m));
        assert.equal(vuelta.length, m.length);
        assert.deepEqual(Array.from(vuelta), Array.from(m));
      }),
      { numRuns: 200 },
    );
  });

  it("límites: vacío, un byte y racha mayor que 2^16", () => {
    assert.equal(decodificarRle(codificarRle(new Uint8Array(0))).length, 0);
    assert.deepEqual(Array.from(decodificarRle(codificarRle(Uint8Array.of(7)))), [7]);
    const larga = new Uint8Array(3_000_000).fill(255);
    const cadena = codificarRle(larga);
    assert.ok(cadena.length < 32, `racha de 3 M: ${cadena.length} caracteres`);
    const vuelta = decodificarRle(cadena);
    assert.equal(vuelta.length, larga.length);
    assert.ok(vuelta.every((b) => b === 255));
  });

  for (const [ancho, alto] of [
    [360, 640],
    [820, 1180],
    [1180, 820],
  ]) {
    it(`máscara real generada para ${ancho}x${alto} vuelve idéntica`, () => {
      const { mascara } = generarSistema(20260926, ancho, alto);
      const cadena = codificarRle(mascara.datos);
      console.log(`pgn-1: máscara ${ancho}x${alto} (${mascara.datos.length} bytes) -> ${cadena.length} caracteres`);
      const vuelta = decodificarRle(cadena);
      assert.equal(vuelta.length, mascara.datos.length);
      assert.ok(Buffer.from(vuelta).equals(Buffer.from(mascara.datos)));
    });
  }

  it("una cadena truncada o incoherente lanza (el validador la convierte en descarte)", () => {
    const buena = codificarRle(Uint8Array.of(1, 1, 2, 2, 2));
    assert.throws(() => decodificarRle(buena.slice(0, 4)));
    assert.throws(() => decodificarRle("////"));
  });
});
