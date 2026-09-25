import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generarMascara } from "@/sim/terreno/generador";

// El hash de referencia se calculó una vez, fuera de este test, generando
// la máscara para la semilla 424242 a 200x150 (ver el commit de este
// bloque). No se recalcula aquí llamando a la propia función bajo prueba:
// es un valor congelado e independiente, para no caer en el precedente de
// la flota de un test circular que reconstruye lo que dice comprobar.
const HASH_ESPERADO_SEMILLA_424242 =
  "022b22ddb382741fe23f4a25e3f194d115a04a05a7bfcd342dc4f02e2be180cc";

function hashDeMascara(datos: Uint8Array): string {
  return createHash("sha256").update(datos).digest("hex");
}

test("terreno-1: la misma semilla produce la misma máscara byte a byte, en el mismo proceso", () => {
  const primera = generarMascara(424242, 200, 150);
  const segunda = generarMascara(424242, 200, 150);

  assert.equal(hashDeMascara(primera.datos), hashDeMascara(segunda.datos));
});

test("terreno-1: la misma semilla produce siempre el mismo hash, también entre procesos distintos", () => {
  const mascara = generarMascara(424242, 200, 150);

  assert.equal(hashDeMascara(mascara.datos), HASH_ESPERADO_SEMILLA_424242);
});

test("terreno-1: semillas distintas producen máscaras distintas", () => {
  const semilla424242 = generarMascara(424242, 200, 150);
  const semilla424243 = generarMascara(424243, 200, 150);

  assert.notEqual(hashDeMascara(semilla424242.datos), hashDeMascara(semilla424243.datos));
});
