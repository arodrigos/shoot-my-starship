import { test, expect, type Page } from "@playwright/test";

async function empezar(page: Page, extra = ""): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?muerte=1&modo=barra-libre${extra}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.fijarMuerteSubita !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// El escudo gasta el turno sin depender de la puntería; el drenaje de la
// muerte súbita mata a la nave con menos integridad.
async function matarALaIA(page: Page): Promise<void> {
  await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 9, integridades: [60, 5] }));
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId("equipo-escudo").click();
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => (window.__debug.fantasmasNave ?? []).length === 1, undefined, { timeout: 90000 });
}

// fan-1
test("fantasma: la nave muerta queda como fantasma translúcido con su nombre", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page);
  expect(await page.evaluate(() => window.__debug.fantasmasNave ?? [])).toHaveLength(0);
  const antes = (await page.evaluate(() => window.__debug.naves))!.find((n) => n.id === 1)!;
  await matarALaIA(page);
  const nombre = await page.evaluate(() => window.__debug.controladores![1].nombre);
  const [fantasma] = (await page.evaluate(() => window.__debug.fantasmasNave))!;
  expect(fantasma.nave).toBe(1);
  expect(fantasma.nombre).toBe(nombre);
  expect(fantasma.alfa).toBeGreaterThanOrEqual(0.3);
  expect(fantasma.alfa).toBeLessThanOrEqual(0.5);
  expect(Math.hypot(fantasma.x - antes.x, fantasma.y - antes.y)).toBeLessThanOrEqual(40);
  expect(fantasma.texturaValida).toBe(true);
  expect(await page.evaluate(() => (window.__debug.fantasmasNave ?? []).length)).toBe(1);
  await page.screenshot({ path: "capturas/fantasma-360x640.png" });
});

test("fantasma: con movimiento reducido no hay vaivén", async ({ page }) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await empezar(page);
  await matarALaIA(page);
  const y0 = (await page.evaluate(() => window.__debug.fantasmasNave))![0].yVisible;
  await page.waitForTimeout(3000);
  const y1 = (await page.evaluate(() => window.__debug.fantasmasNave))![0].yVisible;
  expect(y1).toBe(y0);
});

// fan-3 (render-5)
test("fantasma: el fantasma sobrevive a la pérdida de contexto WebGL", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page);
  await matarALaIA(page);
  await page.evaluate(() => {
    const canvas = document.querySelector("#game-container canvas") as HTMLCanvasElement;
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGL2RenderingContext;
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    setTimeout(() => ext?.restoreContext(), 200);
  });
  await page.waitForFunction(() => (window.__debug.webgl?.restauraciones ?? 0) >= 1, undefined, { timeout: 20000 });
  const [fantasma] = (await page.evaluate(() => window.__debug.fantasmasNave))!;
  expect(fantasma.texturaValida).toBe(true);
});
