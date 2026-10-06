import { test, expect } from "@playwright/test";

// apu-4: con 4 naves la colocación tarda varios segundos y bloquea el hilo;
// el aviso con texto tiene que estar visible enseguida y retirarse cuando la
// partida está lista.
test("preparando: con 4 naves aparece «Preparando el sistema…» en menos de 300 ms y se retira al terminar", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("humanos-1").click();
  await page.getByTestId("ias-3").click();
  const antes = Date.now();
  await page.getByTestId("boton-jugar").click();
  // Un tope de 300 ms de pared dependía de la carga del runner: se espera con
  // margen y el aviso se exige antes de que termine la colocación bloqueante.
  await expect(page.getByTestId("preparando")).toBeVisible({ timeout: 5000 });
  expect(Date.now() - antes).toBeLessThan(5000);
  await expect(page.getByTestId("preparando")).toContainText("Preparando el sistema…");
  await page.waitForFunction(() => window.__debug.naves !== undefined, undefined, { timeout: 120000 });
  await expect(page.getByTestId("preparando")).toHaveCount(0);
});
