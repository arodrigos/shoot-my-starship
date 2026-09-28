import { test, expect } from "@playwright/test";
import type { EventoSimulacion } from "@/sim/partida/eventos";

function danioAlObjetivo(eventos: readonly EventoSimulacion[] | undefined): number {
  return (eventos ?? [])
    .filter((evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> => evento.tipo === "impacto" && evento.objetivo === 1)
    .reduce((total, evento) => total + evento.danio, 0);
}

// Duplicadas a propósito (convención ya establecida en control-1.e2e.ts): el
// e2e no importa del código fuente, así que si alguna vez divergen, este test
// falla de forma ruidosa, no en silencio.
const GANANCIA_ANGULO_GRADOS = 120;
const GANANCIA_POTENCIA = 150;
// Del catálogo real (src/sim/armas/catalogo.ts): Tostadora Orbital, coste 30.
const ARMA_ID = "tostadora-orbital";
const COSTE_ARMA = 30;

async function dispararConGesto(page: import("@playwright/test").Page): Promise<void> {
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();

  const ajusteActual = await page.evaluate(() => window.__debug.control!.ajuste);
  const deltaY = -(solucion!.anguloGrados - ajusteActual.anguloGrados) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (solucion!.potencia - ajusteActual.potencia) / GANANCIA_POTENCIA;

  const inicio = { x: 195, y: 760 };
  const fin = { x: inicio.x + deltaX * 390, y: inicio.y + deltaY * 844 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
}

// modo-1: de punta a punta -- en presupuesto, disparar un arma de pago baja
// el saldo exactamente su precio, y si causa daño lo sube exactamente ese
// daño (leído del evento real, no calculado a mano, porque la fiabilidad/
// dispersión del arma pueden hacer que el daño real difiera del teórico). Dos
// disparos seguidos, arithmetic exacto en cada uno.
test("modo-1: dos disparos seguidos dejan el saldo exactamente en el valor aritmético esperado", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos&modo=presupuesto");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.saldo !== undefined);

  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const saldoInicial = (await page.evaluate(() => window.__debug.saldo))!;
  expect(saldoInicial).toBeGreaterThan(0);

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId(`arma-${ARMA_ID}`).click();
  await dispararConGesto(page);

  await page.waitForFunction(() => window.__debug.numeroTurno === 1);
  const { saldoTrasDisparo1, eventos1 } = await page.evaluate(() => ({
    saldoTrasDisparo1: window.__debug.saldo,
    eventos1: window.__debug.ultimosEventos,
  }));
  const danio1 = danioAlObjetivo(eventos1);
  expect(saldoTrasDisparo1).toBe(saldoInicial - COSTE_ARMA + danio1);

  // Esperar a que la máquina responda antes del segundo disparo del jugador.
  await page.waitForFunction(
    () => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2 && window.__debug.animacionEnCurso === false,
    undefined,
    { timeout: 60000 },
  );

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId(`arma-${ARMA_ID}`).click();
  await dispararConGesto(page);

  await page.waitForFunction(() => window.__debug.numeroTurno === 3);
  const { saldoTrasDisparo2, eventos2 } = await page.evaluate(() => ({
    saldoTrasDisparo2: window.__debug.saldo,
    eventos2: window.__debug.ultimosEventos,
  }));
  const danio2 = danioAlObjetivo(eventos2);
  expect(saldoTrasDisparo2).toBe(saldoTrasDisparo1! - COSTE_ARMA + danio2);
});
