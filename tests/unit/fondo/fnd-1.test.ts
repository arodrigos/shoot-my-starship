import { test } from "node:test";
import assert from "node:assert/strict";
import { alphaPozoEnPunto } from "@/juego/fondo/PozosGravedad";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { Planeta } from "@/sim/gravedad/planetas";
import { crearGeneradorAleatorio } from "@/sim/aleatorio";

// fnd-1: alphaPozoEnPunto no es una aproximación visual inventada -- es una
// transformación monótona y acotada de calcularAceleracionGravitatoria, la
// MISMA función que usa el integrador de vuelo. Comprobamos eso directamente
// en vez de fijar valores concretos de alpha: lo que importa es la relación
// con la física real, no una cifra mágica.
function generarSistema(semilla: number, numPlanetas: number): Planeta[] {
  const aleatorio = crearGeneradorAleatorio(semilla);
  const planetas: Planeta[] = [];
  for (let i = 0; i < numPlanetas; i++) {
    const radio = 40 + aleatorio() * 120;
    planetas.push({
      id: i + 1,
      cx: aleatorio() * 1800 + 60,
      cy: aleatorio() * 900 + 60,
      radio,
      densidad: 1 + aleatorio(),
      pixelesVivos: Math.PI * radio * radio,
    });
  }
  return planetas;
}

test("fnd-1: alphaPozoEnPunto crece y decrece exactamente igual que la magnitud de la aceleración real", () => {
  let comparaciones = 0;
  for (let semilla = 1; semilla <= 5; semilla++) {
    const planetas = generarSistema(semilla * 1000, 3);
    const aleatorio = crearGeneradorAleatorio(semilla * 7);
    const puntos = Array.from({ length: 40 }, () => ({
      x: aleatorio() * 1920,
      y: aleatorio() * 1080,
    }));

    for (let i = 0; i < puntos.length; i++) {
      for (let j = i + 1; j < puntos.length; j++) {
        const a = puntos[i];
        const b = puntos[j];
        const magA = magnitud(calcularAceleracionGravitatoria(planetas, a.x, a.y));
        const magB = magnitud(calcularAceleracionGravitatoria(planetas, b.x, b.y));
        const alphaA = alphaPozoEnPunto(planetas, a.x, a.y);
        const alphaB = alphaPozoEnPunto(planetas, b.x, b.y);

        // Monotonía: el orden entre dos puntos según la aceleración real debe
        // conservarse en el alpha dibujado, salvo que ambos ya estén
        // saturados al tope visual (ahí el orden real deja de ser visible a
        // propósito, por diseño del recorte).
        if (alphaA < 0.5 || alphaB < 0.5) {
          if (magA > magB) assert.ok(alphaA >= alphaB, `magA>magB pero alphaA(${alphaA}) < alphaB(${alphaB})`);
          if (magA < magB) assert.ok(alphaA <= alphaB, `magA<magB pero alphaA(${alphaA}) > alphaB(${alphaB})`);
          comparaciones++;
        }
      }
    }
  }
  assert.ok(comparaciones >= 200, `se esperaban al menos 200 comparaciones, hubo ${comparaciones}`);
});

test("fnd-1: a la misma distancia, un planeta más grande y denso siempre se pinta con más alpha que uno pequeño", () => {
  const pequeno: Planeta = { id: 1, cx: 1000, cy: 500, radio: 40, densidad: 1, pixelesVivos: Math.PI * 40 * 40 };
  const grande: Planeta = { id: 1, cx: 1000, cy: 500, radio: 150, densidad: 2, pixelesVivos: Math.PI * 150 * 150 * 2 };

  for (const distancia of [100, 200, 400, 800]) {
    const alphaPequeno = alphaPozoEnPunto([pequeno], 1000 + distancia, 500);
    const alphaGrande = alphaPozoEnPunto([grande], 1000 + distancia, 500);
    assert.ok(
      alphaGrande >= alphaPequeno,
      `a distancia ${distancia}, el planeta grande (${alphaGrande}) debería tener alpha >= que el pequeño (${alphaPequeno})`,
    );
  }
});

test("fnd-1: alphaPozoEnPunto nunca sale del rango [0, 0.5]", () => {
  const planetas = generarSistema(42, 4);
  const aleatorio = crearGeneradorAleatorio(99);
  for (let i = 0; i < 100; i++) {
    const x = aleatorio() * 1920;
    const y = aleatorio() * 1080;
    const alpha = alphaPozoEnPunto(planetas, x, y);
    assert.ok(alpha >= 0 && alpha <= 0.5, `alpha ${alpha} fuera de [0, 0.5] en (${x}, ${y})`);
  }
});

function magnitud(v: { x: number; y: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}
