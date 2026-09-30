import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import {
  puntosSilueta,
  familiaVisualDe,
  hashSilueta,
  type FamiliaVisual,
} from "@/juego/proyectiles/geometriaProyectil";
import type { PuntoProyectil } from "@/juego/proyectiles/geometriaProyectil";

// pyl-1: un arma representante por cada una de las ocho familias visuales,
// confirmadas contra familiaVisualDe (no elegidas a ojo) para que este test
// no se desincronice si el catálogo cambia de armas.
const REPRESENTANTE_POR_FAMILIA: Record<FamiliaVisual, string> = {
  bomba: "pepinazo-cortesia",
  capsula: "mortero-lamentable",
  racimo: "racimo-de-tuppers",
  chatarra: "pelota-de-chatarra",
  orbe: "graviton-segunda-mano",
  flecha: "andanada-de-flechas",
  broca: "barrena-planetaria",
  haz: "rayo-laser",
};

// Firma de forma independiente del tamaño: número de vértices y las
// distancias al centroide (ordenadas, normalizadas por la mayor) redondeadas
// a dos decimales. Dos siluetas que sean la misma cápsula recoloreada
// producirían la misma firma aunque su hash de coordenadas absolutas
// difiriera por escala -- que es justo lo que este criterio (camino_critico)
// exige descartar, no que las coordenadas absolutas no coincidan.
function firmaDeForma(puntos: readonly PuntoProyectil[]): string {
  const cx = puntos.reduce((s, p) => s + p.x, 0) / puntos.length;
  const cy = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
  const distancias = puntos.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const maxDistancia = Math.max(...distancias);
  const normalizadas = distancias
    .map((d) => (maxDistancia > 0 ? d / maxDistancia : 0))
    .sort((a, b) => a - b)
    .map((d) => d.toFixed(2));
  return `${puntos.length}:${normalizadas.join(",")}`;
}

test("pyl-1: cada una de las ocho familias visuales es reconocible por su forma, no solo por su hash", () => {
  const firmas = new Map<string, FamiliaVisual>();
  for (const [familia, idArma] of Object.entries(REPRESENTANTE_POR_FAMILIA) as [FamiliaVisual, string][]) {
    const arma = buscarArma(idArma);
    assert.equal(
      familiaVisualDe(arma),
      familia,
      `${idArma}: se esperaba que representara a "${familia}" pero familiaVisualDe devuelve otra cosa`,
    );
    const firma = firmaDeForma(puntosSilueta(arma));
    const familiaPrevia = firmas.get(firma);
    assert.ok(
      !familiaPrevia,
      `${familia} (${idArma}) comparte firma de forma con "${familiaPrevia}" -- misma silueta con otro nombre`,
    );
    firmas.set(firma, familia);
  }
  assert.equal(firmas.size, 8);
});

test("pyl-1: los ocho hashes de silueta (uno por familia) son distintos dos a dos", () => {
  const hashes = new Set<string>();
  for (const [familia, idArma] of Object.entries(REPRESENTANTE_POR_FAMILIA) as [FamiliaVisual, string][]) {
    const arma = buscarArma(idArma);
    const hash = hashSilueta(puntosSilueta(arma));
    assert.ok(!hashes.has(hash), `${familia} (${idArma}): hash de silueta repetido`);
    hashes.add(hash);
  }
  assert.equal(hashes.size, 8);
});

test("pyl-1: la silueta de cada familia tiene al menos tres vértices propios (no es un punto ni un segmento degenerado)", () => {
  for (const [familia, idArma] of Object.entries(REPRESENTANTE_POR_FAMILIA) as [FamiliaVisual, string][]) {
    const arma = buscarArma(idArma);
    const puntos = puntosSilueta(arma);
    assert.ok(puntos.length >= 3, `${familia}: solo ${puntos.length} vértices, no forma una silueta reconocible`);
  }
});
