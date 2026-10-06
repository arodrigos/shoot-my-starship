import { test, expect } from "@playwright/test";

// modo-4: barra libre es el modo de siempre -- todas las armas disparables
// desde el turno 1 sin descuento, y sin ningún rastro de saldo/precio en la
// UI (ni siquiera oculto: comprobamos ausencia del testid, no solo que no se
// vea).
test("modo-4: en barra libre no hay saldo ni precios, y las armas de pago están disponibles desde el turno 1", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos&modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.numeroTurno !== undefined);

  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  expect(await page.evaluate(() => window.__debug.saldo)).toBeNull();
  await expect(page.getByTestId("saldo")).toHaveCount(0);

  await page.getByTestId("selector-arma-abrir").click();
  const botonDePago = page.getByTestId("arma-mortero-lamentable");
  await expect(botonDePago).toBeVisible();
  await expect(botonDePago).toBeEnabled();
  await expect(page.getByTestId("precio-mortero-lamentable")).toHaveCount(0);
});
