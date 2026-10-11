import { test, expect } from "@playwright/test";

// mos-5 (no camino_critico): el aviso de una línea es visible en el
// selector de armas antes de disparar, y el disparo se resuelve.
test("mos-5: el selector de armas muestra el aviso de la mosca y se dispara sin error", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await page.getByTestId("selector-arma-abrir").click();
  await expect(page.getByTestId("ayuda-arma-mosca-cojonera")).toBeVisible();
  await expect(page.getByTestId("ayuda-arma-mosca-cojonera")).toContainText("no vuela recta");

  await page.getByTestId("arma-mosca-cojonera").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "mosca-cojonera");
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  // El disparo se resuelve; la broma propia del arma ya no se muestra (ahora
  // habla el locutor de partida cada tres turnos).
  await page.waitForFunction(() => (window.__debug.historialBromas?.length ?? 0) >= 1, undefined, { timeout: 30000 });
});
