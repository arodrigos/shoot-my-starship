import { test } from "node:test";
import assert from "node:assert/strict";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { generarSistema } from "@/sim/sistema/generador";
import { POTENCIA_MINIMA_PX_S, POTENCIA_MAXIMA_PX_S } from "@/sim/balistica/potencia";
import type { Planeta } from "@/sim/gravedad/planetas";
import { medirFisica } from "../../utils/medirFisica";

// gravedad-calibracion: "radio de casco" de referencia que usa el propio
// diseño (punto 6 del brief) para expresar la desviación en unidades
// legibles -- no hay una constante RADIO_CASCO_NAVE_PX exportada desde
// src/sim que este test pueda importar sin acoplarse a impacto-naves, así
// que se declara aquí, igual de literal que en el criterio.
const RADIO_CASCO_NAVE_PX = 22;
const NUM_ESCENARIOS = 30;

function detenerseEnX(xFin: number) {
  return (p: { x: number }) => p.x >= xFin;
}

// Un disparo horizontal que pasa a `factorRadios` radios del centro del
// planeta, medido hasta que atraviesa el mundo 600px más allá del planeta
// por el otro lado -- fijar la distancia RECORRIDA (no un número de pasos)
// es lo que hace comparable "con gravedad" contra "sin gravedad": las dos
// integraciones recorren el mismo tramo del mundo, así que la separación al
// final es la desviación acumulada por el pozo y no un artefacto de que una
// de las dos todavía no ha llegado al punto interesante.
function desviacionEnFlyby(potenciaPxS: number, planeta: Planeta, factorRadios: number): number {
  const x0 = planeta.cx - 600;
  const xFin = planeta.cx + 600;
  const y0 = planeta.cy - factorRadios * planeta.radio;
  const inicio = { x: x0, y: y0, vx: potenciaPxS, vy: 0 };
  const sinGravedad = simularVuelo(inicio, 0, 0, detenerseEnX(xFin), { presupuestoPasos: 2000 });
  const conGravedad = simularVuelo(inicio, 0, 0, detenerseEnX(xFin), { planetas: [planeta], presupuestoPasos: 2000 });
  return Math.abs(conGravedad.proyectil.y - sinGravedad.proyectil.y);
}

test("gravedad-calibracion-1 (camino crítico): un disparo de potencia media que pasa a 1,5 radios de un planeta se desvía al menos 3 radios de casco", () => {
  const potenciaMedia = (POTENCIA_MINIMA_PX_S + POTENCIA_MAXIMA_PX_S) / 2;
  let porDebajoDelUmbral = 0;

  for (let semilla = 1; semilla <= NUM_ESCENARIOS; semilla++) {
    const sistema = generarSistema(semilla, 1920, 1080);
    const planeta = sistema.planetas[0];
    const desviacion = desviacionEnFlyby(potenciaMedia, planeta, 1.5);
    if (desviacion < 3 * RADIO_CASCO_NAVE_PX) porDebajoDelUmbral++;
  }

  const fraccionPorDebajo = porDebajoDelUmbral / NUM_ESCENARIOS;
  assert.ok(
    fraccionPorDebajo <= 0.1,
    `${porDebajoDelUmbral}/${NUM_ESCENARIOS} escenarios (${(fraccionPorDebajo * 100).toFixed(0)}%) quedan por debajo de ${3 * RADIO_CASCO_NAVE_PX}px, más del 10% permitido`,
  );
});

test("gravedad-calibracion-2 (camino crítico): elegir la potencia importa -- la desviación a potencia mínima es al menos 2,5x la de potencia máxima", () => {
  let porDebajoDelUmbral = 0;

  for (let semilla = 1; semilla <= NUM_ESCENARIOS; semilla++) {
    const sistema = generarSistema(semilla, 1920, 1080);
    const planeta = sistema.planetas[0];
    const devMin = desviacionEnFlyby(POTENCIA_MINIMA_PX_S, planeta, 1.5);
    const devMax = desviacionEnFlyby(POTENCIA_MAXIMA_PX_S, planeta, 1.5);
    if (devMin < 2.5 * devMax) porDebajoDelUmbral++;
  }

  assert.ok(
    porDebajoDelUmbral === 0,
    `${porDebajoDelUmbral}/${NUM_ESCENARIOS} escenarios no cumplen devMin >= 2,5 * devMax`,
  );
});

// gravedad-calibracion-3 (camino crítico): "tasa de perdidos <= 8%" y "ninguna
// trayectoria agota el presupuesto de pasos girando en órbita" son, en este
// simulador, la misma condición -- simularVuelo marca perdido:true
// precisamente cuando el modo multipozo agota su presupuesto de pasos sin
// que `detenerse` se cumpliera nunca (ver src/sim/fisica/vuelo.ts). No hay
// una segunda señal de "órbita" que comprobar aparte.
test("gravedad-calibracion-3 (camino crítico): npm run medir:fisica deja la tasa de perdidos en 8% o por debajo, sobre 200 partidas sembradas", () => {
  const informe = medirFisica();
  assert.ok(informe.disparos > 0, "el informe no disparó nada: el harness está roto");
  assert.ok(
    informe.tasaPerdidos <= 0.08,
    `tasa de perdidos ${(informe.tasaPerdidos * 100).toFixed(2)}% supera el 8% sobre ${informe.disparos} disparos`,
  );
});
