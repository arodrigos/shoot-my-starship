import { test } from "node:test";
import assert from "node:assert/strict";
import { PASO_FIJO_MS } from "@/sim/tiempo";
import { GRAVEDAD_REFERENCIA_PX_S2, integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { PRESUPUESTO_VUELO_MULTIPOZO_PASOS, simularVuelo } from "@/sim/fisica/vuelo";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { Planeta } from "@/sim/gravedad/planetas";

// Planeta pequeño y muy denso, y velocidad tangencial ajustada a la
// circular teórica (v = sqrt(G*M/r)) a esa distancia: un disparo que jamás
// aterriza porque orbita en vez de caer, que es justo el caso que antes de
// este bloque lanzaba "posible vuelo infinito".
const PLANETA: Planeta = { id: 1, cx: 500, cy: 500, radio: 25, densidad: 1, pixelesVivos: 1_819_165 };
const DISTANCIA_ORBITA = 120;
const VELOCIDAD_ORBITAL = 301.59289474462014;
const INICIO: EstadoProyectil = { x: PLANETA.cx + DISTANCIA_ORBITA, y: PLANETA.cy, vx: 0, vy: -VELOCIDAD_ORBITAL };

test("grav-6: un disparo en órbita estable agota el presupuesto de vuelo como 'proyectil-perdido', nunca como excepción", () => {
  assert.doesNotThrow(() => {
    const resultado = simularVuelo(INICIO, 0, 0, () => false, { planetas: [PLANETA] });
    assert.equal(resultado.perdido, true);
    assert.equal(resultado.pasos, PRESUPUESTO_VUELO_MULTIPOZO_PASOS);
  });
});

test("grav-6: en las 12s del presupuesto, el disparo en órbita completa más de una vuelta entera alrededor del planeta", () => {
  const pasoS = PASO_FIJO_MS / 1000;
  let proyectil = INICIO;
  let anguloAnterior = Math.atan2(proyectil.y - PLANETA.cy, proyectil.x - PLANETA.cx);
  let anguloAcumulado = 0;

  for (let paso = 0; paso < PRESUPUESTO_VUELO_MULTIPOZO_PASOS; paso++) {
    const aceleracion = calcularAceleracionGravitatoria([PLANETA], proyectil.x, proyectil.y);
    proyectil = integrarPasoProyectil(proyectil, aceleracion.y / GRAVEDAD_REFERENCIA_PX_S2, aceleracion.x, pasoS);

    const anguloActual = Math.atan2(proyectil.y - PLANETA.cy, proyectil.x - PLANETA.cx);
    let delta = anguloActual - anguloAnterior;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    anguloAcumulado += delta;
    anguloAnterior = anguloActual;
  }

  assert.ok(Math.abs(anguloAcumulado) > 2 * Math.PI, `ángulo acumulado ${anguloAcumulado} debería superar una vuelta completa`);
});
