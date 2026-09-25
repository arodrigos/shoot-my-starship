import { test, expect } from "@playwright/test";

// control-2: 10 pulsaciones de +0.1° cambian el ángulo exactamente 1.0°, y
// los botones de paso fino miden al menos 24x24 px CSS (WCAG 2.2 SC 2.5.8).
test("los botones de paso fino miden >=24x24 px CSS y 10 pulsaciones cambian el ángulo 1.0°", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const boton = page.getByTestId("paso-angulo-mas");
  const caja = await boton.boundingBox();
  expect(caja).not.toBeNull();
  expect(caja!.width).toBeGreaterThanOrEqual(24);
  expect(caja!.height).toBeGreaterThanOrEqual(24);

  const botonMenos = page.getByTestId("paso-angulo-menos");
  const cajaMenos = await botonMenos.boundingBox();
  expect(cajaMenos!.width).toBeGreaterThanOrEqual(24);
  expect(cajaMenos!.height).toBeGreaterThanOrEqual(24);

  const anguloInicial = (await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados))!;

  for (let i = 0; i < 10; i++) {
    await boton.click();
  }

  const anguloFinal = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
  expect(Math.abs(anguloFinal - (anguloInicial + 1.0))).toBeLessThanOrEqual(1e-9);
});
