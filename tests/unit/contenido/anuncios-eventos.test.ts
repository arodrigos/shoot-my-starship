import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { ANUNCIOS_EVENTOS, anuncioMuerteSubitaDrenaje, textoLocutado } from "@/contenido/anunciosEventos";
import { obtenerUniverso, publicarCartel, reiniciarUniverso, retirarCartel } from "@/juego/control/universoStore";
import { CATALOGO_EVENTOS } from "@/sim/universo/catalogoEventos";

// anu-1 (invariante): cada tipo del catálogo tiene exactamente un anuncio, con
// el título del catálogo y una explicación con número o con el nombre del efecto.
test("anu-1: cada evento del catálogo tiene un anuncio con título y una explicación con número", () => {
  assert.deepEqual(Object.keys(ANUNCIOS_EVENTOS).sort(), CATALOGO_EVENTOS.map((e) => e.tipo).sort());
  for (const definicion of CATALOGO_EVENTOS) {
    const anuncio = ANUNCIOS_EVENTOS[definicion.tipo];
    assert.equal(anuncio.titulo, definicion.nombre);
    assert.match(anuncio.explicacion, /\d/, definicion.tipo);
  }
});

test("anu-2: el drenaje nombra el daño de la ronda y la voz lo lee entero", () => {
  const anuncio = anuncioMuerteSubitaDrenaje(8);
  assert.match(anuncio.explicacion, /8 de vida/);
  assert.equal(textoLocutado(anuncio, "Todos"), "Muerte súbita. Todos. Todos pierden 8 de vida.");
});

// anu-1 (invariante): los carteles de un mismo turno salen de uno en uno y en
// el orden de los eventos, sin que ninguno pise al anterior.
test("anu-1: la cola muestra los carteles de uno en uno y en orden", () => {
  fc.assert(
    fc.property(fc.array(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 8 }), (titulos) => {
      reiniciarUniverso();
      for (const titulo of titulos) publicarCartel({ titulo, quien: null, texto: "x" });
      const vistos: string[] = [];
      for (let i = 0; i < titulos.length; i++) {
        const actual = obtenerUniverso().cartel;
        assert.ok(actual);
        vistos.push(actual.titulo);
        retirarCartel(actual.clave);
      }
      assert.deepEqual(vistos, titulos);
      assert.equal(obtenerUniverso().cartel, null);
    }),
  );
});

test("anu-1: retirar un cartel que no es el visible no hace nada", () => {
  reiniciarUniverso();
  publicarCartel({ titulo: "A", quien: null, texto: "x" });
  publicarCartel({ titulo: "B", quien: null, texto: "x" });
  const claveB = 99;
  retirarCartel(claveB);
  assert.equal(obtenerUniverso().cartel?.titulo, "A");
});
