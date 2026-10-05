import { test, expect } from "@playwright/test";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import { elegirArmasYConfirmar } from "./utilesControl";

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
// Del catálogo real (src/sim/armas/catalogo.ts): Tostadora Orbital, coste 75
// tras el reprecio de armas-reprecio-roles (antes 30).
const ARMA_ID = "tostadora-orbital";
const COSTE_ARMA = 75;

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

// modo-1 (reescrito por economia-loadout): el saldo se paga al ELEGIR el arma
// y disparar ya no lo mueve: ni cuesta ni, si causa daño, ingresa. Un
// disparo con daño real deja el saldo exactamente donde lo dejó la selección.
test("modo-1: el saldo baja al elegir y un disparo con daño real no lo mueve", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos&modo=presupuesto");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await elegirArmasYConfirmar(page, [ARMA_ID, "despedida"]);
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.saldo !== undefined);

  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const saldoTrasSeleccion = (await page.evaluate(() => window.__debug.saldo))!;
  expect(saldoTrasSeleccion).toBe(1000 - COSTE_ARMA - 120);

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId(`arma-${ARMA_ID}`).click();
  await dispararConGesto(page);

  await page.waitForFunction(() => window.__debug.numeroTurno === 1);
  const { saldoTrasDisparo1, eventos1 } = await page.evaluate(() => ({
    saldoTrasDisparo1: window.__debug.saldo,
    eventos1: window.__debug.ultimosEventos,
  }));
  expect(danioAlObjetivo(eventos1), "el disparo tiene que causar daño real para probar que no ingresa").toBeGreaterThan(0);
  expect(saldoTrasDisparo1).toBe(saldoTrasSeleccion);
});
