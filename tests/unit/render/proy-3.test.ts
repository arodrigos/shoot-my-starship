import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentoHazLaser } from "@/juego/proyectiles/geometriaProyectil";

// Referencia de Bresenham construida DENTRO del test (no importada de la
// implementación): esta flota ya tuvo un test de destino seguro que se
// comprobaba a sí mismo, y esto es justo lo que evita repetirlo.
function lineaBresenham(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const puntos: { x: number; y: number }[] = [];
  let cx = Math.round(x0);
  const cy0 = Math.round(y0);
  let cy = cy0;
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - cx);
  const sx = cx < ex ? 1 : -1;
  const dy = -Math.abs(ey - cy);
  const sy = cy < ey ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    puntos.push({ x: cx, y: cy });
    if (cx === ex && cy === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      cx += sx;
    }
    if (e2 <= dx) {
      err += dx;
      cy += sy;
    }
  }
  return puntos;
}

// Distancia de un punto al segmento origen-impacto: si el láser es de verdad
// un haz recto, todo punto de la referencia de Bresenham cae casi encima del
// segmento (la propia rasterización introduce como mucho ~0.71px de error).
function distanciaASegmento(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  if (largo2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2));
  const proyX = a.x + t * dx;
  const proyY = a.y + t * dy;
  return Math.hypot(p.x - proyX, p.y - proyY);
}

test("proy-3: el haz láser es la misma recta que una referencia de Bresenham origen-impacto", () => {
  const origen = { x: 120, y: 640 };
  const impacto = { x: 900, y: 210 };

  const [inicioHaz, finHaz] = segmentoHazLaser(origen, impacto);
  assert.deepEqual(inicioHaz, origen);
  assert.deepEqual(finHaz, impacto);

  const referencia = lineaBresenham(origen.x, origen.y, impacto.x, impacto.y);
  for (const punto of referencia) {
    const distancia = distanciaASegmento(punto, inicioHaz, finHaz);
    assert.ok(distancia <= 1, `punto de Bresenham (${punto.x},${punto.y}) a ${distancia.toFixed(2)}px del haz, debería ser un trazo recto`);
  }
});

test("proy-3: el haz no tiene vuelo animado -- es el mismo segmento sea cual sea la distancia", () => {
  const casos: [{ x: number; y: number }, { x: number; y: number }][] = [
    [{ x: 0, y: 0 }, { x: 500, y: 500 }],
    [{ x: 300, y: 100 }, { x: 40, y: 900 }],
  ];
  for (const [origen, impacto] of casos) {
    const [a, b] = segmentoHazLaser(origen, impacto);
    assert.deepEqual(a, origen);
    assert.deepEqual(b, impacto);
  }
});
