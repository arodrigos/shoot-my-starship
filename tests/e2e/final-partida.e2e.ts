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

// El escudo gasta el turno sin depender de la puntería: el final lo decide el
// drenaje de la muerte súbita, que mata primero a la nave con menos integridad.
async function gastarTurnoConEscudo(page: Page): Promise<void> {
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId("equipo-escudo").click();
  await page.getByTestId("disparar").click();
}

// txt-1
test("final de partida: gana el único humano y se le habla en segunda persona", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page);
  await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 9, integridades: [20, 5] }));
  await gastarTurnoConEscudo(page);
  await page.waitForFunction(() => window.__debug.ganador !== undefined, undefined, { timeout: 90000 });
  expect(await page.evaluate(() => window.__debug.ganador)).toBe(0);
  await expect(page.getByTestId("ganador-nombre")).toHaveText("¡Has ganado!");
  await expect(page.getByTestId("parte-de-guerra")).not.toContainText("Gana Tú");
});

test("final de partida: si gana la IA se nombra a la IA", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page);
  await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 9, integridades: [5, 20] }));
  await gastarTurnoConEscudo(page);
  await page.waitForFunction(() => window.__debug.ganador !== undefined, undefined, { timeout: 90000 });
  const nombreIA = await page.evaluate(() => window.__debug.controladores![1].nombre);
  await expect(page.getByTestId("ganador-nombre")).toHaveText(`Gana ${nombreIA}`);
});
