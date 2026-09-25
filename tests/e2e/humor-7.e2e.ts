import { test, expect } from "@playwright/test";

// humor-7: al terminar la partida (forzarFinDePartida siempre termina en
// Despedida, que autoimpacta a quien la dispara) debe aparecer la pantalla
// final con una medalla y un texto que cite números reales de la partida, no
// un remate fijo -- aquí se comprueba la mitad de presentación; la lógica
// pura de generarParteDeGuerra ya la cubre humor-7 (unit).
test("humor-7: al terminar la partida aparece el parte de guerra con la medalla y estadísticas reales", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0));

  const pantalla = page.getByTestId("parte-de-guerra");
  await expect(pantalla).toBeVisible();
  await expect(page.getByTestId("parte-de-guerra-medalla")).not.toBeEmpty();
  await expect(page.getByTestId("parte-de-guerra-texto")).not.toBeEmpty();

  const parte = await page.evaluate(() => window.__debug.parteDeGuerra);
  expect(parte).not.toBeNull();
  expect(parte!.estadisticas.disparos).toBeGreaterThan(0);
  // Despedida siempre autoimpacta a quien la dispara (fiabilidad 1): la
  // Cruz del Fuego Amigo es la rama de mayor precedencia y forzarFinDePartida
  // solo usa esa arma, así que esta es la medalla determinista de este guion.
  expect(parte!.medalla).toBe("Cruz del Fuego Amigo");
  expect(parte!.texto).toContain(String(parte!.estadisticas.autoimpactos));
});
