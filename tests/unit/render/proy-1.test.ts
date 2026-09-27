import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { puntosSilueta, hashSilueta, dimensionMayor } from "@/juego/proyectiles/geometriaProyectil";

test("proy-1: ningún proyectil es un punto -- toda arma dibuja 18px o más en su dimensión mayor", () => {
  for (const arma of CATALOGO_ARMAS) {
    const dimension = dimensionMayor(puntosSilueta(arma));
    assert.ok(dimension >= 18, `${arma.id}: silueta de ${dimension.toFixed(1)}px, por debajo de los 18px que exige el brief`);
  }
});

test("proy-1: las siluetas del catálogo son distinguibles entre sí (hash sin colisiones)", () => {
  const hashes = new Set<string>();
  for (const arma of CATALOGO_ARMAS) {
    const hash = hashSilueta(puntosSilueta(arma));
    assert.ok(!hashes.has(hash), `${arma.id}: su silueta coincide con la de otra arma ya vista (hash "${hash}")`);
    hashes.add(hash);
  }
  assert.equal(hashes.size, CATALOGO_ARMAS.length);
});
