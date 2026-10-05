import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  ZONA_MUERTA_APUNTADO_PX,
  anguloDesdeDedo,
  potenciaDesdeDistancia,
} from "@/juego/control/apuntado";

const coordenada = fc.double({ min: -2000, max: 2000, noNaN: true });

// Invariante apu-1/apu-2: para cualquier nave y dedo a más de 8 px, el ángulo
// está en [0, 360) y coincide con atan2 de la dirección nave→dedo (con la y de
// pantalla invertida) con un error ≤ 0,01°.
test("apuntado-y-relevo: el ángulo del dedo está en [0,360) y coincide con atan2 con error ≤ 0,01°", () => {
  fc.assert(
    fc.property(coordenada, coordenada, coordenada, coordenada, (nx, ny, dx, dy) => {
      fc.pre(Math.hypot(dx - nx, dy - ny) > ZONA_MUERTA_APUNTADO_PX);
      const angulo = anguloDesdeDedo({ x: nx, y: ny }, { x: dx, y: dy });
      assert.notEqual(angulo, null);
      assert.ok(angulo! >= 0 && angulo! < 360, `fuera de rango: ${angulo}`);
      // Referencia independiente: se reconstruye el punto desde el ángulo y se
      // compara con el vector real, sin repetir la fórmula bajo prueba.
      const vx = dx - nx;
      const vy = ny - dy;
      const rad = (angulo! * Math.PI) / 180;
      const cruz = Math.cos(rad) * vy - Math.sin(rad) * vx;
      const punto = Math.cos(rad) * vx + Math.sin(rad) * vy;
      const errorGrados = (Math.atan2(cruz, punto) * 180) / Math.PI;
      assert.ok(Math.abs(errorGrados) <= 0.01, `error angular ${errorGrados}°`);
    }),
    { numRuns: 500 },
  );
});

test("apuntado-y-relevo: dentro de la zona muerta no se cambia el ángulo", () => {
  assert.equal(anguloDesdeDedo({ x: 100, y: 100 }, { x: 105, y: 103 }), null);
  assert.equal(anguloDesdeDedo({ x: 100, y: 100 }, { x: 100, y: 100 }), null);
});

test("apuntado-y-relevo: los cuatro puntos cardinales dan 0, 90, 180 y 270 grados", () => {
  const nave = { x: 200, y: 200 };
  assert.equal(anguloDesdeDedo(nave, { x: 300, y: 200 }), 0);
  assert.equal(anguloDesdeDedo(nave, { x: 200, y: 100 }), 90);
  assert.equal(anguloDesdeDedo(nave, { x: 100, y: 200 }), 180);
  // El caso de Adrián: el dedo justo debajo de la nave apunta a 270°.
  assert.equal(anguloDesdeDedo(nave, { x: 200, y: 300 }), 270);
});

// Invariante: potencia en [0,100] y monótona no decreciente con la distancia.
test("apuntado-y-relevo: la potencia está en [0,100] y no decrece con la distancia", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 5000, noNaN: true }),
      fc.double({ min: 0, max: 5000, noNaN: true }),
      fc.double({ min: 100, max: 2000, noNaN: true }),
      (d1, d2, lado) => {
        const [menor, mayor] = d1 <= d2 ? [d1, d2] : [d2, d1];
        const pMenor = potenciaDesdeDistancia(menor, lado);
        const pMayor = potenciaDesdeDistancia(mayor, lado);
        assert.ok(pMenor >= 0 && pMenor <= 100);
        assert.ok(pMayor >= 0 && pMayor <= 100);
        assert.ok(pMenor <= pMayor);
      },
    ),
    { numRuns: 500 },
  );
});

test("apuntado-y-relevo: la potencia llega a 100 a 0,4 veces el lado menor", () => {
  assert.equal(potenciaDesdeDistancia(0, 360), 0);
  assert.equal(potenciaDesdeDistancia(144, 360), 100);
  assert.equal(potenciaDesdeDistancia(72, 360), 50);
  assert.equal(potenciaDesdeDistancia(10_000, 360), 100);
});
