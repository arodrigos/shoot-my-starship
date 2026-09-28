import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SALDO_INICIAL } from "@/sim/partida/economia";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

// cie-4: la guía de uso (README.md) tiene que cubrir, de forma comprobable,
// las seis cosas que pide el diseño -- "comprobable" quiere decir que este
// test no solo busca titulares, cruza los datos citados (armas gratis,
// radio de casco, saldo inicial) contra las constantes reales del código,
// para que un README desactualizado por un cambio de catálogo falle aquí en
// vez de callar hasta que Adrián lo note jugando.
async function leerReadme(): Promise<string> {
  const ruta = path.resolve(process.cwd(), "README.md");
  return readFile(ruta, "utf8");
}

test("cie-4: el README cubre los dos modos", async () => {
  const readme = await leerReadme();
  assert.match(readme, /[Bb]arra libre/);
  assert.match(readme, /[Cc]on presupuesto/);
});

test("cie-4: el README explica cómo funciona el dinero, con el saldo inicial real", async () => {
  const readme = await leerReadme();
  assert.match(readme, /saldo inicial|SALDO_INICIAL/);
  assert.match(readme, /cada disparo cuesta/);
  assert.match(readme, new RegExp(String(SALDO_INICIAL)));
});

test("cie-4: el README nombra las tres armas gratis, y son de verdad las tres de coste 0 del catálogo", async () => {
  const readme = await leerReadme();
  const gratisEnCatalogo = CATALOGO_ARMAS.filter((arma) => arma.coste === 0);
  assert.equal(gratisEnCatalogo.length, 3, "el catálogo tiene que declarar exactamente tres armas gratis");
  for (const arma of gratisEnCatalogo) {
    assert.ok(readme.includes(arma.nombre), `el README no nombra el arma gratis "${arma.nombre}"`);
  }
});

test("cie-4: el README declara qué le pasa a la gravedad de un planeta al que le arrancas un trozo", async () => {
  const readme = await leerReadme();
  assert.match(readme, /masa/i);
  assert.match(readme, /centro|radio/i);
  assert.match(readme, /no cambia|fij[ao]s?\b/i);
});

test("cie-4: el README explica qué cuenta como impacto, con el radio de casco real", async () => {
  const readme = await leerReadme();
  assert.match(readme, /casco/i);
  assert.match(readme, /distancia/i);
  assert.match(readme, new RegExp(`${RADIO_CASCO_NAVE_PX}px`));
});

test("cie-4: el README dice qué se espera que juzgue Adrián al jugar", async () => {
  const readme = await leerReadme();
  assert.match(readme, /controlable|caótico/i);
  assert.match(readme, /satisfactorio|imposible/i);
  assert.match(readme, /presupuesto/i);
  assert.match(readme, /broma/i);
});
