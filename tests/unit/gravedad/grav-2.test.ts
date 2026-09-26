import { test } from "node:test";
import assert from "node:assert/strict";
import { PASO_FIJO_MS } from "@/sim/tiempo";
import { GRAVEDAD_REFERENCIA_PX_S2, integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { Planeta } from "@/sim/gravedad/planetas";

// Comprueba paso a paso (no solo el resultado final) porque lo que grav-2
// vigila es que NUNCA aparezca un NaN/Infinity durante el paso por el centro,
// no solo al terminar: por eso no usa simularVuelo como caja negra, sino que
// repite aquí, a mano, exactamente la misma transformación aceleración ->
// (gravedad, deriva) que hace src/sim/fisica/vuelo.ts en su modo multipozo.
test("grav-2: pasar por el centro exacto de un planeta no produce NaN/Infinity ni una velocidad desbocada", () => {
  const pasoS = PASO_FIJO_MS / 1000;
  const velocidadSalida = 300;
  const planeta: Planeta = { id: 1, cx: 900, cy: 900, radio: 60, densidad: 1, pixelesVivos: Math.round(Math.PI * 60 * 60) };

  let proyectil: EstadoProyectil = { x: 100, y: 900, vx: velocidadSalida, vy: 0 };
  let velocidadMaxima = velocidadSalida;

  for (let paso = 0; paso < 10_000; paso++) {
    const aceleracion = calcularAceleracionGravitatoria([planeta], proyectil.x, proyectil.y);
    proyectil = integrarPasoProyectil(
      proyectil,
      aceleracion.y / GRAVEDAD_REFERENCIA_PX_S2,
      aceleracion.x,
      pasoS,
    );

    assert.ok(Number.isFinite(proyectil.x), `paso ${paso}: x no finito (${proyectil.x})`);
    assert.ok(Number.isFinite(proyectil.y), `paso ${paso}: y no finito (${proyectil.y})`);
    assert.ok(Number.isFinite(proyectil.vx), `paso ${paso}: vx no finito (${proyectil.vx})`);
    assert.ok(Number.isFinite(proyectil.vy), `paso ${paso}: vy no finito (${proyectil.vy})`);

    const velocidad = Math.hypot(proyectil.vx, proyectil.vy);
    velocidadMaxima = Math.max(velocidadMaxima, velocidad);
    assert.ok(
      velocidad <= 6 * velocidadSalida,
      `paso ${paso}: velocidad ${velocidad} supera 6x la velocidad de salida (${6 * velocidadSalida})`,
    );
  }

  assert.ok(velocidadMaxima >= velocidadSalida);
});
