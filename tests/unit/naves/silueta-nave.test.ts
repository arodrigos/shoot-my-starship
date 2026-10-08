import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  cajaPuntos,
  puntosCascoConDanio,
  puntosCascoVariante,
  nivelDanio,
  type NivelDanio,
  type PuntoCasco,
  type VarianteNave,
} from "@/sim/naves/geometriaCasco";

// Cajas de las naves de dev (escala 3), medidas antes de este bloque.
const CAJA_DEV: Readonly<Record<VarianteNave, { ancho: number; alto: number }>> = {
  0: { ancho: 144.9, alto: 132 },
  1: { ancho: 158.7, alto: 36.96 },
  2: { ancho: 151.8, alto: 72.6 },
  3: { ancho: 158.7, alto: 132 },
};
const VARIANTES: readonly VarianteNave[] = [0, 1, 2, 3];
const NIVELES: readonly NivelDanio[] = ["alta", "media", "baja"];

function areaFirmada(puntos: readonly PuntoCasco[]): number {
  let suma = 0;
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i]!;
    const b = puntos[(i + 1) % puntos.length]!;
    suma += a.x * b.y - b.x * a.y;
  }
  return suma / 2;
}

// Área de la parte del polígono por encima y por debajo del eje x, recortando
// cada arista contra y = 0.
function areasPorMitad(puntos: readonly PuntoCasco[]): { arriba: number; abajo: number } {
  let arriba = 0;
  let abajo = 0;
  const trozo = (poligono: PuntoCasco[]) => Math.abs(areaFirmada(poligono));
  for (const lado of [-1, 1]) {
    const recortado: PuntoCasco[] = [];
    for (let i = 0; i < puntos.length; i++) {
      const a = puntos[i]!;
      const b = puntos[(i + 1) % puntos.length]!;
      const aDentro = a.y * lado >= 0;
      const bDentro = b.y * lado >= 0;
      if (aDentro) recortado.push(a);
      if (aDentro !== bDentro) {
        const t = (0 - a.y) / (b.y - a.y);
        recortado.push({ x: a.x + t * (b.x - a.x), y: 0 });
      }
    }
    if (lado === -1) arriba = trozo(recortado);
    else abajo = trozo(recortado);
  }
  return { arriba, abajo };
}

test("nav-1: de 10 a 16 vértices por silueta y sin deterioro", () => {
  for (const v of VARIANTES) {
    const n = puntosCascoVariante(v, 1).length;
    assert.ok(n >= 10 && n <= 16, `variante ${v}: ${n} vértices`);
  }
});

test("nav-1 (invariante 1): la caja de cada silueta y estado de deterioro mide entre 0,45 y 0,52 de la de dev en cada eje (≤ 0,52 con deterioro)", () => {
  fc.assert(
    fc.property(fc.constantFrom(...VARIANTES), fc.constantFrom(...NIVELES), fc.constantFrom<1 | -1>(1, -1), (v, nivel, dir) => {
      const caja = cajaPuntos(puntosCascoConDanio(dir, nivel, v));
      assert.ok(caja.ancho <= 0.52 * CAJA_DEV[v].ancho + 1e-9, `variante ${v} ${nivel}: ancho ${caja.ancho}`);
      assert.ok(caja.alto <= 0.52 * CAJA_DEV[v].alto + 1e-9, `variante ${v} ${nivel}: alto ${caja.alto}`);
    }),
    { numRuns: 200 },
  );
  for (const v of VARIANTES) {
    const caja = cajaPuntos(puntosCascoVariante(v, 1));
    assert.ok(caja.ancho >= 0.45 * CAJA_DEV[v].ancho, `variante ${v}: ancho ${caja.ancho} por debajo de 0,45`);
    assert.ok(caja.alto >= 0.45 * CAJA_DEV[v].alto, `variante ${v}: alto ${caja.alto} por debajo de 0,45`);
  }
});

test("nav-1: el morro es el vértice más adelantado y su ángulo interior es ≤ 70°", () => {
  for (const v of VARIANTES) {
    for (const dir of [1, -1] as const) {
      const puntos = puntosCascoVariante(v, dir);
      const morro = puntos.reduce((mejor, p) => (p.x * dir > mejor.x * dir ? p : mejor));
      const i = puntos.indexOf(morro);
      const anterior = puntos[(i + puntos.length - 1) % puntos.length]!;
      const siguiente = puntos[(i + 1) % puntos.length]!;
      const a = Math.atan2(anterior.y - morro.y, anterior.x - morro.x);
      const b = Math.atan2(siguiente.y - morro.y, siguiente.x - morro.x);
      let angulo = Math.abs(a - b);
      if (angulo > Math.PI) angulo = 2 * Math.PI - angulo;
      assert.ok((angulo * 180) / Math.PI <= 70, `variante ${v} dir ${dir}: morro de ${((angulo * 180) / Math.PI).toFixed(1)}°`);
    }
  }
});

test("nav-1: los apéndices son simétricos (diferencia de área ≤ 5 %) con y sin deterioro leve", () => {
  for (const v of VARIANTES) {
    const { arriba, abajo } = areasPorMitad(puntosCascoVariante(v, 1));
    assert.ok(Math.abs(arriba - abajo) / Math.max(arriba, abajo) <= 0.05, `variante ${v}: ${arriba} frente a ${abajo}`);
  }
});

test("nav-1: la tobera es un subcontorno estrecho en la popa", () => {
  for (const v of VARIANTES) {
    for (const dir of [1, -1] as const) {
      const puntos = puntosCascoVariante(v, dir);
      const popa = Math.min(...puntos.map((p) => p.x * dir));
      const enPopa = puntos.filter((p) => Math.abs(p.x * dir - popa) < 1e-9);
      assert.equal(enPopa.length, 2, `variante ${v} dir ${dir}: la popa es un lado recto`);
      const ancho = Math.abs(enPopa[0]!.y - enPopa[1]!.y);
      assert.ok(ancho > 0 && ancho <= 12, `variante ${v}: tobera de ${ancho} u`);
    }
  }
});

test("nav-1: cada deterioro cambia la silueta y el morro y la tobera siguen en ella", () => {
  for (const v of VARIANTES) {
    const sana = puntosCascoConDanio(1, "alta", v);
    const media = puntosCascoConDanio(1, "media", v);
    const baja = puntosCascoConDanio(1, "baja", v);
    assert.notDeepEqual(sana, media);
    assert.notDeepEqual(media, baja);
    for (const dañada of [media, baja]) {
      for (const clave of [sana[0]!, ...sana.filter((p) => p.x === Math.min(...sana.map((q) => q.x)))]) {
        assert.ok(dañada.some((p) => p.x === clave.x && p.y === clave.y), `variante ${v}: se perdió un vértice de morro o tobera`);
      }
    }
  }
});

test("nav-1: nivelDanio parte la integridad en tramos 66 / 33", () => {
  assert.equal(nivelDanio(100), "alta");
  assert.equal(nivelDanio(67), "alta");
  assert.equal(nivelDanio(66), "media");
  assert.equal(nivelDanio(34), "media");
  assert.equal(nivelDanio(33), "baja");
  assert.equal(nivelDanio(0), "baja");
});
