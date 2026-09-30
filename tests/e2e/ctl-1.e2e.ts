import { test, expect } from "@playwright/test";
import { arrastrarBarraHasta } from "./utilesControl";

// ctl-1 (control-angulo-potencia): recorrer un control de punta a punta no
// cambia el otro eje NI UN ÁPICE -- la independencia real que Adrián pidió,
// no una aproximación con tolerancia.
test("recorrer la barra de ángulo entera no cambia la potencia, y viceversa", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const potenciaAntes = (await page.evaluate(() => window.__debug.control!.ajuste.potencia))!;
  await arrastrarBarraHasta(page, "barra-angulo", 0);
  await arrastrarBarraHasta(page, "barra-angulo", 1);
  const potenciaDespues = await page.evaluate(() => window.__debug.control!.ajuste.potencia);
  expect(potenciaDespues).toEqual(potenciaAntes);

  const anguloAntes = (await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados))!;
  await arrastrarBarraHasta(page, "barra-potencia", 0);
  await arrastrarBarraHasta(page, "barra-potencia", 1);
  const anguloDespues = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
  expect(anguloDespues).toEqual(anguloAntes);
});
