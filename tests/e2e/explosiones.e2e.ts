import { test, expect, type Page } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

async function arrastrarHasta(page: Page, anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
  const ajusteAntes = (await page.evaluate(() => window.__debug.control!.ajuste))!;
  const deltaY = -(anguloObjetivo - ajusteAntes.anguloGrados) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (potenciaObjetivo - ajusteAntes.potencia) / GANANCIA_POTENCIA;
  const inicio = { x: 160, y: 560 };
  const fin = { x: inicio.x + deltaX * 360, y: inicio.y + deltaY * 640 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();
}

// Dispara la solución balística del jugador (un impacto real contra el
// rival) y espera a que el turno avance, con polling sobre el estado real.
async function dispararImpactoReal(page: Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await arrastrarHasta(page, solucion!.anguloGrados, solucion!.potencia);
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, numeroTurnoAntes, { timeout: 120000 });
}

// exp-1 (camino crítico): lo que la cáscara dibuja coincide, una a una, con
// las detonaciones que declara el núcleo, y la onda llega al radio real.
test("exp-1: cada detonación del turno tiene su explosión, en su sitio y con la onda en su radio de efecto", async ({ page }) => {
  test.setTimeout(150000);
  await dispararImpactoReal(page);

  const { detonaciones, efectos } = await page.evaluate(() => ({
    detonaciones: window.__debug.detonaciones!,
    efectos: window.__debug.efectosVisibles!,
  }));
  expect(detonaciones.length).toBeGreaterThan(0);
  expect(efectos).toHaveLength(detonaciones.length);
  detonaciones.forEach((detonacion, i) => {
    expect(Math.hypot(efectos[i].x - detonacion.x, efectos[i].y - detonacion.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(efectos[i].radioOnda - detonacion.radioEfectoU)).toBeLessThanOrEqual(1);
    expect(efectos[i].sobre).toBe(detonacion.sobre);
    expect(efectos[i].particulas).toBeGreaterThan(0);
  });
  expect(detonaciones.some((d) => d.radioEfectoU === 55)).toBe(true);
});

// exp-4: con movimiento reducido la explosión sigue informando (anillo en el
// radio de efecto) pero sin partículas ni sacudida de cámara.
test("exp-4: con prefers-reduced-motion la explosión no emite partículas ni sacude la cámara", async ({ page }) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await dispararImpactoReal(page);

  const { detonaciones, efectos, sacudidas } = await page.evaluate(() => ({
    detonaciones: window.__debug.detonaciones!,
    efectos: window.__debug.efectosVisibles!,
    sacudidas: window.__debug.sacudidasCamara ?? 0,
  }));
  expect(efectos).toHaveLength(detonaciones.length);
  expect(efectos.length).toBeGreaterThan(0);
  detonaciones.forEach((detonacion, i) => {
    expect(efectos[i].particulas).toBe(0);
    expect(Math.abs(efectos[i].radioOnda - detonacion.radioEfectoU)).toBeLessThanOrEqual(1);
  });
  expect(sacudidas).toBe(0);
});
