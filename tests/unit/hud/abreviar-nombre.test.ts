import test from "node:test";
import assert from "node:assert/strict";
import { abreviarNombre } from "@/juego/hud/IntegridadHUD";

// ini-2: la abreviatura nunca pasa del máximo de la pestaña y no toca lo que ya cabe.
test("ini-2: con 4 naves un nombre largo se abrevia a 6 caracteres con elipsis", () => {
  assert.equal(abreviarNombre("0123456789ABCDEF", 4), "01234…");
  assert.equal(Array.from(abreviarNombre("0123456789ABCDEF", 4)).length, 6);
});

test("ini-2: con 3 naves caben 8 y con 2 el nombre entero", () => {
  assert.equal(abreviarNombre("0123456789ABCDEF", 3), "0123456…");
  assert.equal(abreviarNombre("0123456789ABCDEF", 2), "0123456789ABCDEF");
});

test("ini-2: un nombre que ya cabe se queda como está", () => {
  assert.equal(abreviarNombre("Ana", 4), "Ana");
  assert.equal(abreviarNombre("123456", 4), "123456");
});

test("ini-2: no parte un carácter fuera del plano básico", () => {
  assert.equal(abreviarNombre("😀😀😀😀😀😀😀😀", 4), "😀😀😀😀😀…");
});
