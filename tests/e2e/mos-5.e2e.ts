import { test, expect } from "@playwright/test";

// mos-5 (no camino_critico): el aviso de una línea es visible en el
// selector de armas antes de disparar, y las bromas propias del arma
// aparecen de verdad en pantalla al usarla (no solo declaradas en el
// catálogo, que ya cubre mos-5.test.ts).
test("mos-5: el selector de armas muestra el aviso de la mosca y su broma propia aparece al usarla", async ({ page }) => {
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

  await page.waitForFunction(() => (window.__debug.historialBromas?.length ?? 0) >= 1, undefined, { timeout: 30000 });
  const historial = (await page.evaluate(() => window.__debug.historialBromas))!;
  const turnoDeLaMosca = historial.find((entrada) => entrada.numeroTurno === 0);
  expect(turnoDeLaMosca, "no se registró broma para el turno 0 (el disparo de la mosca)").toBeDefined();
  // La broma propia se AÑADE a la de la voz (ver reaccionarABroma en
  // Partida.ts): comprobar que aparece de verdad, no adivinar el texto
  // completo que depende también de qué frase tocó en el sorteo de la voz.
  expect(turnoDeLaMosca!.textoImpacto).toMatch(/Ni ella se lo esperaba/);
});
