import test from "node:test";
import assert from "node:assert/strict";
import { PERSONALIDADES } from "@/sim/ia/personalidades";
import fc from "fast-check";
import { abreviarNombre } from "@/juego/hud/IntegridadHUD";

// ini-2: la abreviatura se lee (quita títulos antes que letras), nunca pasa del
// máximo de la pestaña y no toca lo que ya cabe.
test("ini-2: con 4 naves se quitan los títulos de delante y el nombre se lee entero", () => {
  assert.equal(abreviarNombre("La Contable", 4), "Contable");
  assert.equal(abreviarNombre("Almirante Bisagra", 4), "Bisagra");
  assert.equal(abreviarNombre("Chispa", 4), "Chispa");
});

test("ini-2: un nombre de un solo término demasiado largo se corta con elipsis", () => {
  assert.equal(abreviarNombre("0123456789ABCDEF", 4), "0123456…");
  assert.equal(abreviarNombre("0123456789ABCDEF", 3), "012345678…");
  assert.equal(abreviarNombre("0123456789ABCDEF", 2), "0123456789ABCDEF");
});

test("ini-2: «Jugador 2» pasa a «J2» cuando no cabe, y se queda entero si cabe", () => {
  assert.equal(abreviarNombre("Jugador 2", 4), "J2");
  assert.equal(abreviarNombre("Jugador 2", 3), "Jugador 2");
});

test("ini-2: los nombres reales de las IA, tal como llegan al HUD, se leen enteros", () => {
  for (const p of PERSONALIDADES) {
    for (const naves of [2, 3, 4]) {
      const visible = abreviarNombre(p.nombre, naves);
      assert.ok(!visible.endsWith("…"), `${p.nombre} con ${naves} naves: ${visible}`);
    }
  }
  assert.equal(abreviarNombre("Almirante Bisagra", 2), "Bisagra");
});

test("ini-2: un nombre que ya cabe se queda como está", () => {
  assert.equal(abreviarNombre("Ana", 4), "Ana");
  assert.equal(abreviarNombre("12345678", 4), "12345678");
});

test("ini-2: no parte un carácter fuera del plano básico", () => {
  assert.equal(abreviarNombre("😀😀😀😀😀😀😀😀😀😀", 4), "😀😀😀😀😀😀😀…");
});

test("ini-2 (propiedad): sin número final, nunca pasa del máximo de su pestaña y lo que cabe no cambia", () => {
  const palabra = fc.stringMatching(/^[A-Za-zñÁÉ]{1,14}$/);
  fc.assert(
    fc.property(fc.array(palabra, { minLength: 1, maxLength: 4 }), fc.integer({ min: 2, max: 4 }), (palabras, naves) => {
      const nombre = palabras.join(" ");
      const maximo = naves >= 4 ? 8 : naves === 3 ? 10 : 16;
      const resultado = abreviarNombre(nombre, naves);
      const cabe = Array.from(nombre).length <= maximo;
      return Array.from(resultado).length <= maximo && (!cabe || resultado === nombre);
    }),
  );
});
