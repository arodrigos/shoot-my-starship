import { test, expect } from "@playwright/test";

// mir-1: oculta por presupuesto, la mira no se recalcula con el apuntado y
// reaparece con un único cálculo nuevo. El coste se fuerza con
// __debug.forzarMiraOculta, que pasa por el mismo camino que el coste real.
test("mir-1: la mira oculta por presupuesto no se recalcula al apuntar y reaparece con un solo cálculo", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
  await page.waitForFunction(() => (window.__debug.previsualizacion?.puntos.length ?? 0) >= 2, undefined, { timeout: 60000 });

  await page.evaluate(() => window.__debug.forzarMiraOculta!(true));
  await page.waitForFunction(() => window.__debug.previsualizacion === null);
  // Un cálculo ya en vuelo cuando se oculta puede cerrar su cuenta: se espera
  // a que el contador deje de moverse sobre fotogramas de la escena.
  const c0 = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let previo = window.__debug.calculosPrevisualizacion!;
        let quietos = 0;
        const paso = (): void => {
          const actual = window.__debug.calculosPrevisualizacion!;
          quietos = actual === previo ? quietos + 1 : 0;
          previo = actual;
          if (quietos >= 10) resolve(actual);
          else requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      }),
  );

  const ajustes: Array<[number, number]> = [[30, 40], [35, 45], [40, 50], [45, 55], [50, 60], [55, 65], [60, 70], [65, 75], [70, 80], [75, 85]];
  for (const [angulo, potencia] of ajustes) {
    await page.evaluate(([a, p]) => window.__debug.fijarApuntado!(a, p), [angulo, potencia]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const c1 = await page.evaluate(() => window.__debug.calculosPrevisualizacion);
  expect(c1).toBe(c0);
  expect(await page.evaluate(() => window.__debug.previsualizacion)).toBeNull();

  await page.evaluate(() => window.__debug.forzarMiraOculta!(false));
  await page.waitForFunction(() => (window.__debug.previsualizacion?.puntos.length ?? 0) >= 2, undefined, { timeout: 60000 });
  const c2 = await page.evaluate(() => window.__debug.calculosPrevisualizacion);
  expect(c2).toBe(c0 + 1);
  const ajuste = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(ajuste.anguloGrados).toBe(75);
  expect(ajuste.potencia).toBe(85);
});
