import { test, expect } from "@playwright/test";

// arte-siluetas-3 (camino_critico, devuelto por el gatekeeper): el
// indicador de nave propia (el triángulo que marcarActiva()/estaActiva()
// muestran u ocultan, ver Nave.ts) no tenía ninguna forma de comprobarse
// fuera de Phaser -- ni window.__debug lo exponía. Ahora DebugNave.activa
// refleja Nave.estaActiva() en cada refresco (mismo canal que nivelDanio y
// hashSilueta), así que esto comprueba lo que pide el criterio: el
// indicador está en la nave que tiene el turno, nunca en la otra, y se
// mueve cuando el turno cambia.
test("arte-siluetas-3: el indicador de nave propia sigue al turno real", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.naves !== undefined && window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  function soloUnaActiva(naves: readonly { readonly id: number; readonly activa: boolean }[], idEsperado: number): void {
    const activas = naves.filter((nave) => nave.activa).map((nave) => nave.id);
    expect(activas, `se esperaba solo la nave ${idEsperado} activa, estaban activas ${JSON.stringify(activas)}`).toEqual([
      idEsperado,
    ]);
  }

  const navesAntes = (await page.evaluate(() => window.__debug.naves))!;
  const turnoAntes = (await page.evaluate(() => window.__debug.turno))!;
  soloUnaActiva(navesAntes, turnoAntes);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((antes) => window.__debug.turno !== antes, turnoAntes, { timeout: 30000 });

  const navesDespues = (await page.evaluate(() => window.__debug.naves))!;
  const turnoDespues = (await page.evaluate(() => window.__debug.turno))!;
  expect(turnoDespues).not.toBe(turnoAntes);
  soloUnaActiva(navesDespues, turnoDespues);
});
