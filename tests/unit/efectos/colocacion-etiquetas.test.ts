import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { colocarEtiqueta, seSolapan, type Rect } from "@/juego/efectos/colocacionEtiquetas";

// colocacion-etiquetas: con un disparo a quemarropa salen a la vez varios
// números de daño y el «Estaba aquí» casi en el mismo punto. Se prueba en las
// tres pantallas del encargo (en px CSS, que es lo que mide una etiqueta en
// pantalla) que, colocadas una tras otra, ninguna pisa a otra y todas caben.
const PANTALLAS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
] as const;
const SEPARACION = 4;
const MARGEN = 8;
// Mismas medidas que en Partida.ts: un número de daño con su silueta y los
// 36 px de subida, y el «Estaba aquí» de 34 px de mundo (unos 10 px CSS).
const NUMERO_DANIO = { ancho: 48, alto: 22 + 36 };
const ESTABA_AQUI = { ancho: 60, alto: 12 };
const TOLERANCIA = 1e-9;

function area(pantalla: { ancho: number; alto: number }): Rect {
  return { x: MARGEN, y: MARGEN, ancho: pantalla.ancho - 2 * MARGEN, alto: pantalla.alto - 2 * MARGEN };
}

function dentroDe(r: Rect, a: Rect): boolean {
  return r.x >= a.x - TOLERANCIA && r.y >= a.y - TOLERANCIA && r.x + r.ancho <= a.x + a.ancho + TOLERANCIA && r.y + r.alto <= a.y + a.alto + TOLERANCIA;
}

function colocarTodas(deseadas: readonly Rect[], zona: Rect): Rect[] {
  const colocadas: Rect[] = [];
  for (const deseado of deseadas) colocadas.push(colocarEtiqueta(deseado, colocadas, zona, SEPARACION));
  return colocadas;
}

function comprobar(colocadas: readonly Rect[], zona: Rect): void {
  for (const [i, r] of colocadas.entries()) {
    assert.ok(dentroDe(r, zona), `la etiqueta ${i} (${JSON.stringify(r)}) se sale de ${JSON.stringify(zona)}`);
    for (const [j, otra] of colocadas.entries()) {
      if (j <= i) continue;
      // Sin separación: lo que se exige es que no se pisen.
      assert.ok(!seSolapan(r, otra), `las etiquetas ${i} y ${j} se solapan: ${JSON.stringify(r)} / ${JSON.stringify(otra)}`);
    }
  }
}

test("una etiqueta sola se queda donde se pidió", () => {
  const zona = area(PANTALLAS[0]);
  const deseado = { x: 100, y: 200, ...NUMERO_DANIO };
  assert.deepEqual(colocarEtiqueta(deseado, [], zona, SEPARACION), deseado);
});

test("caso a quemarropa: -23, -50 y «Estaba aquí» en el mismo punto se apilan sin pisarse", () => {
  for (const pantalla of PANTALLAS) {
    const zona = area(pantalla);
    const cx = pantalla.ancho / 2;
    const cy = pantalla.alto / 2;
    const colocadas = colocarTodas(
      [
        { x: cx - NUMERO_DANIO.ancho / 2, y: cy - NUMERO_DANIO.alto, ...NUMERO_DANIO },
        { x: cx - NUMERO_DANIO.ancho / 2, y: cy - NUMERO_DANIO.alto + 2, ...NUMERO_DANIO },
        { x: cx - ESTABA_AQUI.ancho / 2, y: cy - 20, ...ESTABA_AQUI },
      ],
      zona,
    );
    comprobar(colocadas, zona);
    // Se prefiere apilar en vertical: la primera no se mueve y la segunda
    // sigue centrada sobre el mismo punto.
    assert.equal(colocadas[0].x, cx - NUMERO_DANIO.ancho / 2);
    assert.equal(colocadas[1].x, cx - NUMERO_DANIO.ancho / 2);
  }
});

test("pegadas a una esquina, las etiquetas se apartan hacia dentro sin salirse", () => {
  for (const pantalla of PANTALLAS) {
    const zona = area(pantalla);
    for (const [px, py] of [
      [0, 0],
      [pantalla.ancho, 0],
      [0, pantalla.alto],
      [pantalla.ancho, pantalla.alto],
    ]) {
      const deseadas = [NUMERO_DANIO, NUMERO_DANIO, ESTABA_AQUI, ESTABA_AQUI].map((t) => ({ x: px - t.ancho / 2, y: py - t.alto / 2, ...t }));
      comprobar(colocarTodas(deseadas, zona), zona);
    }
  }
});

test("propiedad: de 2 a 6 etiquetas en (casi) el mismo punto nunca se solapan ni se salen", () => {
  const etiqueta = fc.record({
    tipo: fc.constantFrom(NUMERO_DANIO, ESTABA_AQUI),
    dx: fc.double({ min: -6, max: 6, noNaN: true }),
    dy: fc.double({ min: -6, max: 6, noNaN: true }),
  });
  fc.assert(
    fc.property(
      fc.constantFrom(...PANTALLAS),
      fc.double({ min: -20, max: 1200, noNaN: true }),
      fc.double({ min: -20, max: 1200, noNaN: true }),
      fc.array(etiqueta, { minLength: 2, maxLength: 6 }),
      (pantalla, px, py, etiquetas) => {
        const zona = area(pantalla);
        const deseadas = etiquetas.map(({ tipo, dx, dy }) => ({ x: px + dx - tipo.ancho / 2, y: py + dy - tipo.alto, ...tipo }));
        comprobar(colocarTodas(deseadas, zona), zona);
      },
    ),
    { numRuns: 500 },
  );
});
