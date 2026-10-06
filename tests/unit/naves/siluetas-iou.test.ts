import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { puntosCascoVariante, ANCHO_CASCO, ALTO_CASCO, type VarianteNave, type PuntoCasco } from "@/sim/naves/geometriaCasco";

const LADO = 64;

// Par-impar: punto dentro de un polígono cualquiera (no solo convexo).
function dentro(x: number, y: number, poligono: readonly PuntoCasco[]): boolean {
  let en = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) en = !en;
  }
  return en;
}

// Máscara binaria a LADO x LADO del casco centrado, con el lado mayor del
// casco escalado al lienzo para que la comparación no premie el tamaño.
function mascara(variante: VarianteNave, dir: 1 | -1): boolean[] {
  const puntos = puntosCascoVariante(variante, dir);
  const mitad = Math.max(ANCHO_CASCO, ALTO_CASCO) / 2 + 4;
  const celda = (2 * mitad) / LADO;
  const salida: boolean[] = [];
  for (let fy = 0; fy < LADO; fy++) {
    for (let fx = 0; fx < LADO; fx++) {
      salida.push(dentro(-mitad + (fx + 0.5) * celda, -mitad + (fy + 0.5) * celda, puntos));
    }
  }
  return salida;
}

function iou(a: boolean[], b: boolean[]): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) inter++;
    if (a[i] || b[i]) union++;
  }
  return inter / union;
}

const VARIANTES: readonly VarianteNave[] = [0, 1, 2, 3];

// sil-1 (invariante 2): para todo par de familias distintas, y mirando a
// cualquiera de los dos lados, la IoU de sus máscaras es <= 0,6.
test("sil-1: la IoU de cada par de familias de casco es <= 0,6 (property test)", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...VARIANTES),
      fc.constantFrom(...VARIANTES),
      fc.constantFrom<1 | -1>(1, -1),
      (a, b, dir) => {
        fc.pre(a !== b);
        const valor = iou(mascara(a, dir), mascara(b, dir));
        assert.ok(valor <= 0.6, `IoU ${valor.toFixed(3)} entre familias ${a} y ${b}`);
      },
    ),
    { numRuns: 100 },
  );
});

test("sil-1: las cuatro familias tienen máscaras no vacías y distintas dos a dos", () => {
  const mascaras = VARIANTES.map((v) => mascara(v, 1));
  for (const m of mascaras) assert.ok(m.some(Boolean));
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.notDeepEqual(mascaras[i], mascaras[j]);
});
