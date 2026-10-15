import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  differenceCiede2000,
  filterDeficiencyDeuter,
  filterDeficiencyProt,
  filterDeficiencyTrit,
  parse,
  type Color,
  wcagContrast,
} from "culori";
import { COLORES_NAVE, colorCss, colorDeAsiento } from "../../../src/juego/naves/paletaNaves";
import { COLOR_FONDO_ESPACIO } from "../../../src/juego/paleta";

// ΔE2000 ≈ 1 es la diferencia mínima perceptible; un orden de magnitud por
// encima se distingue sin esfuerzo. Se exige 12 y no 10 porque la marca es
// pequeña y el tamaño reduce la capacidad de discriminar.
const UMBRAL_DELTA_E = 12;
// WCAG 1.4.11: componentes gráficos frente a su fondo.
const UMBRAL_CONTRASTE = 3;

type Condicion = "normal" | "protanopia" | "deuteranopia" | "tritanopia";
// culori tipa los filtros con una unión enorme de modos de color; se acotan
// a Color -> Color, que es lo único que usa el test.
const simulaciones: Record<Condicion, (c: Color) => Color> = {
  normal: (c) => c,
  protanopia: filterDeficiencyProt(1) as (c: Color) => Color,
  deuteranopia: filterDeficiencyDeuter(1) as (c: Color) => Color,
  tritanopia: filterDeficiencyTrit(1) as (c: Color) => Color,
};
const condiciones = Object.keys(simulaciones) as Condicion[];

const delta = differenceCiede2000();

function vista(condicion: Condicion, asiento: number): Color {
  const color = parse(colorCss(COLORES_NAVE[asiento]));
  assert.ok(color, `color de asiento ${asiento} no parseable`);
  return simulaciones[condicion](color);
}

const pares: [number, number][] = [];
for (let a = 0; a < COLORES_NAVE.length; a++) {
  for (let b = a + 1; b < COLORES_NAVE.length; b++) pares.push([a, b]);
}

test("pal-1: ΔE2000 entre asientos ≥ 12 en visión normal y con prot/deuter/trit", () => {
  for (const cond of condiciones) {
    const medidas = pares.map(([a, b]) => ({ a, b, d: delta(vista(cond, a), vista(cond, b)) }));
    console.log(
      `[pal-1] ${cond}: ` + medidas.map((m) => `${m.a}-${m.b}=${m.d.toFixed(1)}`).join(" ") +
        ` | mín=${Math.min(...medidas.map((m) => m.d)).toFixed(1)}`,
    );
    for (const m of medidas) {
      assert.ok(
        m.d >= UMBRAL_DELTA_E,
        `par ${m.a}-${m.b} con ${cond}: ΔE2000=${m.d.toFixed(1)} < ${UMBRAL_DELTA_E}`,
      );
    }
  }
});

test("pal-2: contraste WCAG de cada asiento contra el fondo espacial ≥ 3:1", () => {
  for (const cond of condiciones) {
    const cs: string[] = [];
    for (let i = 0; i < COLORES_NAVE.length; i++) {
      const c = wcagContrast(vista(cond, i), colorCss(COLOR_FONDO_ESPACIO));
      cs.push(`${i}=${c.toFixed(2)}`);
      assert.ok(c >= UMBRAL_CONTRASTE, `asiento ${i} con ${cond}: contraste ${c.toFixed(2)} < ${UMBRAL_CONTRASTE}`);
    }
    console.log(`[pal-2] ${cond}: ${cs.join(" ")}`);
  }
});

test("invariante: colorDeAsiento(id) === colorCss(COLORES_NAVE[id]) para 0..3", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3 }), (id) => colorDeAsiento(id) === colorCss(COLORES_NAVE[id])),
  );
});
