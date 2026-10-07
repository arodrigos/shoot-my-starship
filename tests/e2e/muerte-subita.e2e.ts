import { test, expect, type Page } from "@playwright/test";

async function empezar(page: Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?muerte=1&modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.fijarMuerteSubita !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// El turno del humano se gasta en el escudo, que no frena el drenaje: así el
// disparo de la IA no puede matar a nadie antes de que empiece la ronda 10 y
// el resultado lo decide solo el drenaje, sin depender de la puntería.
async function gastarTurnoConEscudo(page: Page): Promise<void> {
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId("equipo-escudo").click();
  await page.getByTestId("disparar").click();
}

// ms-2: aviso en la ronda 9, drenaje simultáneo al empezar la 10 y empate real.
test("muerte súbita: avisa en la ronda 9 y las dos últimas naves caen a la vez en empate", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page);
  await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 9, integridades: [5, 5] }));
  await expect(page.getByTestId("muerte-subita")).toHaveText("Muerte súbita en 1 ronda");

  await gastarTurnoConEscudo(page);
  await page.waitForFunction(() => window.__debug.ganador !== undefined, undefined, { timeout: 90000 });
  const final = await page.evaluate(() => ({ ganador: window.__debug.ganador, ronda: window.__debug.ronda, naves: window.__debug.naves!.map((nave) => nave.integridad) }));
  expect(final.ganador).toBeNull();
  expect(final.ronda).toBe(10);
  expect(final.naves).toEqual([0, 0]);
  await expect(page.getByTestId("ganador-nombre")).toHaveText("¡Empate!");
});

test("muerte súbita: con [5, 20] el drenaje solo mata a la primera y gana la segunda, no hay empate", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page);
  await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 9, integridades: [5, 20] }));
  await gastarTurnoConEscudo(page);
  await page.waitForFunction(() => window.__debug.ganador !== undefined, undefined, { timeout: 90000 });
  expect(await page.evaluate(() => window.__debug.ganador)).toBe(1);
  // La pantalla final debe nombrar a la IA ganadora, no solo mostrar la medalla.
  const nombreIA = await page.evaluate(() => window.__debug.controladores![1].nombre);
  await expect(page.getByTestId("ganador-nombre")).toHaveText(`Gana ${nombreIA}`);
});
