import { test } from "node:test";
import assert from "node:assert/strict";
import { generarSistema } from "@/sim/sistema/generador";
import { hashSistema, MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";

test("sis-1: la misma semilla produce siempre el mismo sistema, bit a bit", () => {
  const primero = generarSistema(20260926, MUNDO_ANCHO, MUNDO_ALTO);
  const segundo = generarSistema(20260926, MUNDO_ANCHO, MUNDO_ALTO);

  assert.equal(hashSistema(primero), hashSistema(segundo));
});

test("sis-1: 200 semillas producen al menos 195 configuraciones distintas", () => {
  const hashes = new Set<string>();
  for (let semilla = 0; semilla < 200; semilla++) {
    hashes.add(hashSistema(generarSistema(semilla, MUNDO_ANCHO, MUNDO_ALTO)));
  }

  assert.ok(hashes.size >= 195, `solo ${hashes.size} configuraciones distintas de 200 semillas`);
});
