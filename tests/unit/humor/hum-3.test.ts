import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIAS_BROMA } from "@/sim/partida/categoriaBroma";
import {
  BANCO_BROMAS_DISPARO,
  BANCO_BROMAS_IMPACTO,
  VOCES_BROMAS,
  bancoDisparoDe,
  bancoImpactoDe,
  todasLasFrasesDeBromas,
} from "@/contenido/bancoBromas";

const MINIMO_POR_COMBO = 5;
const MINIMO_TOTAL = 100;

test("hum-3: el banco de disparo y el de impacto son disjuntos entre sí (ninguna frase se repite entre los dos)", () => {
  const frasesDisparo = new Set(VOCES_BROMAS.flatMap((voz) => bancoDisparoDe(voz)));
  const frasesImpacto = new Set(
    VOCES_BROMAS.flatMap((voz) => CATEGORIAS_BROMA.flatMap((categoria) => bancoImpactoDe(voz, categoria))),
  );
  const interseccion = [...frasesDisparo].filter((frase) => frasesImpacto.has(frase));
  assert.deepEqual(interseccion, [], "no debe haber frases compartidas entre el banco de disparo y el de impacto");
});

test("hum-3: cada voz tiene al menos 5 frases de disparo y ninguna repetida", () => {
  for (const voz of VOCES_BROMAS) {
    const frases = bancoDisparoDe(voz);
    assert.ok(frases.length >= MINIMO_POR_COMBO, `${voz}: banco de disparo con menos de ${MINIMO_POR_COMBO} frases`);
    assert.equal(new Set(frases).size, frases.length, `${voz}: hay frases de disparo repetidas`);
  }
});

test("hum-3: cada combinación voz x categoría de impacto tiene al menos 5 frases y ninguna repetida", () => {
  for (const voz of VOCES_BROMAS) {
    for (const categoria of CATEGORIAS_BROMA) {
      const frases = bancoImpactoDe(voz, categoria);
      assert.ok(
        frases.length >= MINIMO_POR_COMBO,
        `${voz}/${categoria}: banco de impacto con menos de ${MINIMO_POR_COMBO} frases`,
      );
      assert.equal(new Set(frases).size, frases.length, `${voz}/${categoria}: hay frases repetidas`);
    }
  }
});

test("hum-3: el total de frases de bromas (disparo + impacto) supera las 100", () => {
  const total = todasLasFrasesDeBromas();
  assert.ok(total.length > MINIMO_TOTAL, `total de frases = ${total.length}, se esperaba > ${MINIMO_TOTAL}`);
});

test("hum-3: BANCO_BROMAS_DISPARO y BANCO_BROMAS_IMPACTO cubren exactamente las tres voces declaradas", () => {
  assert.deepEqual(new Set(Object.keys(BANCO_BROMAS_DISPARO)), new Set(VOCES_BROMAS));
  assert.deepEqual(new Set(Object.keys(BANCO_BROMAS_IMPACTO)), new Set(VOCES_BROMAS));
  for (const voz of VOCES_BROMAS) {
    assert.deepEqual(new Set(Object.keys(BANCO_BROMAS_IMPACTO[voz])), new Set(CATEGORIAS_BROMA));
  }
});
