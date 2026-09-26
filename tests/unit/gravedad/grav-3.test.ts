import { test } from "node:test";
import assert from "node:assert/strict";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";
import { contarPixelesPorMaterial, masaPlaneta, recalcularRegistro, type Planeta } from "@/sim/gravedad/planetas";

// Radio de suavizado geométrico del planeta (grav-2): pequeño y fijo, nunca
// cambia con el cráter. La densidad se elige para que la masa total caiga en
// un punto donde 2 s de vuelo real produzcan una desviación de decenas de
// píxeles -- lo bastante para que el margen de >15px del criterio no dependa
// de una casualidad numérica.
const RADIO_PLANETA = 80;
const CX = 600;
const CY = 560;
const MASA_OBJETIVO = 1_000_000;
const PASOS_3S = Math.round(3000 / (1000 / 60));

test("grav-3: recalcular la masa desde la máscara tras un cráter cambia el punto de caída del mismo disparo", () => {
  const mascara = crearMascaraVacia(2000, 2000);
  aplicarHuellaCircular(mascara, CX, CY, RADIO_PLANETA, "sumar", 1);
  const pixelesVivosAntes = contarPixelesPorMaterial(mascara).get(1) ?? 0;
  const densidad = MASA_OBJETIVO / pixelesVivosAntes;

  const planetaAntes: Planeta = { id: 1, cx: CX, cy: CY, radio: RADIO_PLANETA, densidad, pixelesVivos: pixelesVivosAntes };
  const inicio = { x: 100, y: 500, vx: 400, vy: 0 };
  const { proyectil: antes } = simularVuelo(inicio, 0, 0, () => false, { planetas: [planetaAntes], presupuestoPasos: PASOS_3S });

  // El cráter (radio 31, mismo centro) queda ENTERAMENTE dentro del planeta
  // (radio 80): el recuento de píxeles que retira es exacto y verificable de
  // forma independiente contra el mismo criterio de distancia que usa
  // aplicarHuellaCircular, no una estimación de área.
  const radioCrater = 31;
  aplicarHuellaCircular(mascara, CX, CY, radioCrater, "restar");
  const pixelesVivosDespues = contarPixelesPorMaterial(mascara).get(1) ?? 0;
  const craterPixelesEsperados = contarPixelesEnCirculo(CX, CY, radioCrater);
  assert.equal(pixelesVivosAntes - pixelesVivosDespues, craterPixelesEsperados);

  const [planetaDespues] = recalcularRegistro([planetaAntes], mascara);
  const masaEsperadaDespues = masaPlaneta(planetaAntes) - craterPixelesEsperados * densidad;
  assert.ok(
    Math.abs(masaPlaneta(planetaDespues) - masaEsperadaDespues) <= 0.005 * masaPlaneta(planetaAntes),
    `masa tras el cráter (${masaPlaneta(planetaDespues)}) debería estar a menos del 0.5% de ${masaEsperadaDespues}`,
  );

  const { proyectil: despues } = simularVuelo(inicio, 0, 0, () => false, { planetas: [planetaDespues], presupuestoPasos: PASOS_3S });

  const desviacionAntes = antes.y - 500;
  const desviacionDespues = despues.y - 500;
  assert.ok(desviacionDespues < desviacionAntes, "con menos masa, el mismo disparo debe desviarse menos hacia el planeta");
  assert.ok(
    desviacionAntes - desviacionDespues > 15,
    `diferencia (${desviacionAntes - desviacionDespues}px) debería ser mayor de 15px`,
  );
});

function contarPixelesEnCirculo(cx: number, cy: number, radio: number): number {
  let total = 0;
  const radioCuadrado = radio * radio;
  for (let y = Math.floor(cy - radio); y <= Math.ceil(cy + radio); y++) {
    for (let x = Math.floor(cx - radio); x <= Math.ceil(cx + radio); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radioCuadrado) total++;
    }
  }
  return total;
}
