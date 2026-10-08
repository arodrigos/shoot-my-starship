import { test, expect } from "@playwright/test";
import { puntoLibreDeArrastre } from "./utilesApuntado";
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
// Del catálogo real (src/sim/armas/catalogo.ts): Pepinazo de Cortesía, coste 55.
const ARMA_ID = "pepinazo-cortesia";
const COSTE_ARMA = 55;

async function dispararConGesto(page: import("@playwright/test").Page): Promise<void> {
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();

  const ajusteActual = await page.evaluate(() => window.__debug.control!.ajuste);
  const deltaY = -(solucion!.anguloGrados - ajusteActual.anguloGrados) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (solucion!.potencia - ajusteActual.potencia) / GANANCIA_POTENCIA;

  const inicio = await puntoLibreDeArrastre(page);
  const fin = { x: inicio.x + deltaX * 390, y: inicio.y + deltaY * 844 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
}

// modo-1 (reescrito por economia-rectificada): el arma de pago se cobra al
// DISPARAR, su precio exacto, y causar daño no ingresa nada: el saldo queda en
// la base menos el precio.
test("modo-1: el saldo baja el precio exacto al disparar y el daño no ingresa", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos&modo=presupuesto");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.saldo !== undefined);

  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  expect(await page.evaluate(() => window.__debug.saldo)).toBe(600);

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId(`arma-${ARMA_ID}`).click();
  await dispararConGesto(page);

  await page.waitForFunction(() => window.__debug.numeroTurno === 1);
  const { saldoTrasDisparo1, eventos1 } = await page.evaluate(() => ({
    saldoTrasDisparo1: window.__debug.saldo,
    eventos1: window.__debug.ultimosEventos,
  }));
  expect(danioAlObjetivo(eventos1), "el disparo tiene que causar daño real para probar que no ingresa").toBeGreaterThan(0);
  expect(saldoTrasDisparo1).toBe(600 - COSTE_ARMA);
});
