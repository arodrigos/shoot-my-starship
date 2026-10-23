import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CLAVE_TEXTO_GRANDE, leerTextoGrandeGuardado } from "@/juego/hud/legibilidad";

const almacenCon = (valor: string | null): Pick<Storage, "getItem"> => ({
  getItem: (clave) => (clave === CLAVE_TEXTO_GRANDE ? valor : null),
});

test("tg-2: la clave guardada es legibilidad:texto-grande", () => {
  assert.equal(CLAVE_TEXTO_GRANDE, "legibilidad:texto-grande");
});

test("tg-2: ausente, 0, basura, JSON y cadena vacía lo dejan apagado; 1 lo enciende", () => {
  for (const v of [null, "0", "basura", '{"x":1}', "", "true"]) assert.equal(leerTextoGrandeGuardado(almacenCon(v)), false, String(v));
  assert.equal(leerTextoGrandeGuardado(almacenCon("1")), true);
});

test("tg-2: un almacenamiento que lanza o inexistente lo deja apagado sin excepción", () => {
  const roto = {
    getItem: () => {
      throw new Error("SecurityError");
    },
  };
  assert.equal(leerTextoGrandeGuardado(roto), false);
  assert.equal(leerTextoGrandeGuardado(undefined), false);
});

test("tg-2: invariante, para cualquier valor guardado el estado es (valor === '1') y no lanza", () => {
  fc.assert(
    fc.property(fc.oneof(fc.constant(null), fc.string(), fc.json()), (valor) => {
      assert.equal(leerTextoGrandeGuardado(almacenCon(valor)), valor === "1");
    }),
    { numRuns: 300 },
  );
});
