import { test, expect } from "@playwright/test";

// hal-1 / hal-3: los halos que se pintan son los de la física real. __debug.halos
// trae los anillos tal y como se hornearon y __debug.aceleracionPozo evalúa la
// aceleración viva del pozo en la página, así que la comparación no repite la
// fórmula en el test.
test("halos: cada planeta enseña 3 o 4 anillos coherentes con la aceleración real y sin rehorneado en reposo", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.halos !== undefined && window.__debug.aceleracionPozo !== undefined && window.__debug.planetas !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();

  const resultado = await page.evaluate(() =>
    window.__debug.halos!.map((pozo) => ({
      id: pozo.id,
      anillos: pozo.anillos.map((a) => ({ ...a, real: window.__debug.aceleracionPozo!(pozo.id, a.r) as number })),
    })),
  );
  const planetas = (await page.evaluate(() => window.__debug.planetas))!;
  expect(resultado.length).toBe(planetas.length);
  for (const pozo of resultado) {
    expect(pozo.anillos.length).toBeGreaterThanOrEqual(3);
    expect(pozo.anillos.length).toBeLessThanOrEqual(4);
    pozo.anillos.forEach((anillo, i) => {
      expect(Math.abs(anillo.real - anillo.aceleracion)).toBeLessThanOrEqual(0.01 * anillo.aceleracion);
      if (i > 0) {
        expect(anillo.r).toBeGreaterThan(pozo.anillos[i - 1].r);
        expect(anillo.opacidad).toBeLessThan(pozo.anillos[i - 1].opacidad);
      }
    });
  }

  // hal-3: dejar pasar fotogramas sin disparar no vuelve a hornear nada.
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__debug.fondoEspacial!.bakes)).toBe(1);
  expect(await page.evaluate(() => window.__debug.fondoEspacial!.rehornoHalos ?? 0)).toBe(0);

  await page.screenshot({ path: "capturas/halos-gravedad-1180x820.png" });
});
