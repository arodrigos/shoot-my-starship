import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  FUERZA_POR_PX_RADIAL,
  GRADOS_POR_PX_GIRO,
  RADIO_CERCA_NAVE_PX,
  UMBRAL_TOQUE_PX,
  avanzarGesto,
  iniciarGesto,
} from "@/juego/control/apuntado";

const NAVE = { x: 200, y: 400 };
const coordenada = fc.double({ min: -1000, max: 1000, noNaN: true });

function mover(dedoInicial: { x: number; y: number }, dedoFinal: { x: number; y: number }, angulo: number, potencia: number) {
  return avanzarGesto(iniciarGesto(dedoInicial), NAVE, dedoFinal, angulo, potencia);
}

// Caso de la tabla de aceptación (dedo-1): dedo 100 px a la derecha de la nave.
test("apuntado-dedo: subir el dedo 40 px a la derecha de la nave sube el ángulo 10° y no toca la fuerza", () => {
  const r = mover({ x: 300, y: 400 }, { x: 300, y: 360 }, 45, 50);
  assert.ok(Math.abs(r.anguloGrados - 55) < 1e-9);
  assert.ok(Math.abs(r.potencia - 50) < 1e-9);
});

test("apuntado-dedo: alejarse 50 px de la nave sube la fuerza 15", () => {
  const inicio = { x: 300, y: 360 };
  const largo = Math.hypot(inicio.x - NAVE.x, inicio.y - NAVE.y);
  const final = { x: inicio.x + (50 * (inicio.x - NAVE.x)) / largo, y: inicio.y + (50 * (inicio.y - NAVE.y)) / largo };
  const r = mover(inicio, final, 55, 50);
  assert.ok(Math.abs(r.potencia - 65) < 1e-9);
  assert.ok(Math.abs(r.anguloGrados - 55) < 1e-9);
});

test("apuntado-dedo: alejar 400 px satura la fuerza en 100", () => {
  assert.equal(mover({ x: 300, y: 400 }, { x: 700, y: 400 }, 45, 50).potencia, 100);
  assert.equal(mover({ x: 300, y: 400 }, { x: 250, y: 400 }, 45, 5).potencia, 0);
});

// Invariante 1: movimiento puramente tangencial.
test("apuntado-dedo: un desplazamiento perpendicular a la línea nave→dedo gira 0,25°/px y no cambia la fuerza", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 60, max: 400, noNaN: true }),
      fc.double({ min: 0, max: 359, noNaN: true }),
      fc.double({ min: -60, max: 60, noNaN: true }),
      fc.double({ min: 100, max: 260, noNaN: true }),
      fc.double({ min: 20, max: 80, noNaN: true }),
      (radio, rumboGrados, px, angulo, potencia) => {
        fc.pre(Math.abs(px) >= UMBRAL_TOQUE_PX);
        const rad = (rumboGrados * Math.PI) / 180;
        const ux = Math.cos(rad);
        const uy = -Math.sin(rad);
        const inicio = { x: NAVE.x + ux * radio, y: NAVE.y + uy * radio };
        // Tangente antihoraria en pantalla (y hacia abajo): (uy, -ux) con la y de juego invertida.
        const final = { x: inicio.x + uy * px, y: inicio.y - ux * px };
        const r = mover(inicio, final, angulo, potencia);
        assert.ok(Math.abs(r.potencia - potencia) <= 0.5, `fuerza ${r.potencia}`);
        assert.ok(Math.abs(r.anguloGrados - (angulo + px * GRADOS_POR_PX_GIRO)) <= 0.05, `ángulo ${r.anguloGrados}`);
      },
    ),
    { numRuns: 300 },
  );
});

// Invariante 2: movimiento puramente radial.
test("apuntado-dedo: un desplazamiento radial cambia la fuerza 0,3/px, saturada, y no el ángulo", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 60, max: 400, noNaN: true }),
      fc.double({ min: 0, max: 359, noNaN: true }),
      fc.double({ min: -60, max: 60, noNaN: true }),
      fc.double({ min: 100, max: 260, noNaN: true }),
      fc.double({ min: 0, max: 100, noNaN: true }),
      (radio, rumboGrados, px, angulo, potencia) => {
        fc.pre(Math.abs(px) >= UMBRAL_TOQUE_PX);
        const rad = (rumboGrados * Math.PI) / 180;
        const ux = Math.cos(rad);
        const uy = -Math.sin(rad);
        const inicio = { x: NAVE.x + ux * radio, y: NAVE.y + uy * radio };
        const final = { x: inicio.x + ux * px, y: inicio.y + uy * px };
        const r = mover(inicio, final, angulo, potencia);
        assert.ok(Math.abs(r.anguloGrados - angulo) <= 0.1, `ángulo ${r.anguloGrados}`);
        const esperada = Math.max(0, Math.min(100, potencia + px * FUERZA_POR_PX_RADIAL));
        assert.ok(Math.abs(r.potencia - esperada) <= 1e-6, `fuerza ${r.potencia} vs ${esperada}`);
      },
    ),
    { numRuns: 300 },
  );
});

// Invariante 3: rangos y toque sin movimiento.
test("apuntado-dedo: cualquier gesto deja ángulo y fuerza en rango, y un toque de menos de 4 px no cambia nada", () => {
  fc.assert(
    fc.property(
      coordenada, coordenada, coordenada, coordenada,
      fc.double({ min: 0, max: 360, noNaN: true }),
      fc.double({ min: 0, max: 100, noNaN: true }),
      (x0, y0, x1, y1, angulo, potencia) => {
        const r = mover({ x: x0, y: y0 }, { x: x1, y: y1 }, angulo, potencia);
        assert.ok(r.anguloGrados >= 0 && r.anguloGrados <= 360);
        assert.ok(r.potencia >= 0 && r.potencia <= 100);
        if (Math.hypot(x1 - x0, y1 - y0) < UMBRAL_TOQUE_PX) {
          assert.equal(r.anguloGrados, angulo);
          assert.equal(r.potencia, potencia);
          assert.equal(r.gesto.iniciado, false);
        }
      },
    ),
    { numRuns: 500 },
  );
});

test("apuntado-dedo: a menos de 30 px de la nave el eje radial es la dirección de la flecha", () => {
  // Flecha a 0° (derecha): mover el dedo hacia la derecha, aunque esté a 10 px
  // de la nave, es «radial» y sube la fuerza; hacia arriba es «tangencial».
  assert.ok(RADIO_CERCA_NAVE_PX === 30);
  const dedo = { x: NAVE.x + 10, y: NAVE.y };
  const radial = mover(dedo, { x: dedo.x + 20, y: dedo.y }, 0, 50);
  assert.ok(Math.abs(radial.potencia - 56) < 1e-9);
  assert.ok(Math.abs(radial.anguloGrados) < 1e-9);
  const lateral = mover(dedo, { x: dedo.x, y: dedo.y - 20 }, 0, 50);
  assert.ok(Math.abs(lateral.anguloGrados - 5) < 1e-9);
  assert.ok(Math.abs(lateral.potencia - 50) < 1e-9);
});

test("apuntado-dedo: el temblor bajo el umbral se acumula y no se pierde al cruzarlo", () => {
  const inicio = { x: 300, y: 400 };
  let g = iniciarGesto(inicio);
  let angulo = 45;
  for (const y of [399, 398, 397.5]) {
    const r = avanzarGesto(g, NAVE, { x: 300, y }, angulo, 50);
    g = r.gesto;
    angulo = r.anguloGrados;
  }
  assert.equal(angulo, 45);
  const r = avanzarGesto(g, NAVE, { x: 300, y: 395 }, angulo, 50);
  assert.ok(Math.abs(r.anguloGrados - (45 + 5 * GRADOS_POR_PX_GIRO)) < 1e-9);
});
