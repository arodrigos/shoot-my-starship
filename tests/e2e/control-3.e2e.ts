import { test, expect } from "@playwright/test";

// control-3: un arrastre vertical en la superficie de apuntado no debe hacer
// scroll de la página, ni pull-to-refresh (aproximado aquí por "la página no
// se ha recargado", comprobando que un marcador puesto antes del gesto
// sigue vivo después), ni seleccionar texto.
test("un arrastre vertical no hace scroll, ni recarga la página, ni selecciona texto", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await page.evaluate(() => {
    (window as unknown as { __marcadorDeNoRecarga?: boolean }).__marcadorDeNoRecarga = true;
  });

  const scrollAntes = await page.evaluate(() => window.scrollY);

  const inicio = { x: 195, y: 800 };
  const fin = { x: 195, y: 450 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(inicio.x, inicio.y + ((fin.y - inicio.y) * i) / 10, { steps: 1 });
  }
  await page.mouse.up();

  const scrollDespues = await page.evaluate(() => window.scrollY);
  expect(scrollDespues).toEqual(scrollAntes);

  const marcadorVivo = await page.evaluate(
    () => (window as unknown as { __marcadorDeNoRecarga?: boolean }).__marcadorDeNoRecarga === true,
  );
  expect(marcadorVivo).toBe(true);

  const seleccion = await page.evaluate(() => window.getSelection()?.toString() ?? "");
  expect(seleccion).toEqual("");
});
