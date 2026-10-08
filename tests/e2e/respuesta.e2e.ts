import { test, expect, type Page } from "@playwright/test";

const LIMITE_MS = 200;
const VIEWPORTS = [
  { ancho: 360, alto: 640 },
  { ancho: 1180, alto: 820 },
];

async function entrarAPartida(page: Page, ancho: number, alto: number): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// Anota si el aviso «está apuntando…» llegó a existir en algún momento: el
// turno de la IA puede durar menos que un poll del test.
async function vigilarAvisoIA(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __vioAvisoIA: string | null }).__vioAvisoIA = null;
    new MutationObserver(() => {
      const aviso = document.querySelector('[data-testid="apuntando-ia"]');
      if (aviso?.textContent) (window as unknown as { __vioAvisoIA: string | null }).__vioAvisoIA = aviso.textContent;
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
}

for (const vp of VIEWPORTS) {
  test(`res-1: ${vp.ancho}x${vp.alto} con CPU ×4, todo toque responde en ≤ 200 ms, también con la IA pensando y en la explosión`, async ({ page }) => {
    test.setTimeout(240000);
    await vigilarAvisoIA(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await entrarAPartida(page, vp.ancho, vp.alto);

    // Turno del humano: el ángulo y el histórico responden.
    await page.getByTestId("paso-angulo-mas").click();
    await page.getByRole("button", { name: /Histórico/ }).click();
    await page.getByRole("button", { name: "Cerrar" }).click();

    const antes = await page.evaluate(() => window.__debug.resultadoTurno);
    await page.getByTestId("disparar").click();

    // Durante el vuelo, la explosión y el turno de la IA: toques al lienzo y a la consola.
    for (let i = 0; i < 3; i++) {
      await page.locator("#game-container canvas").click({ position: { x: 20, y: 20 }, force: true });
    }
    if (await page.getByTestId("boton-ocultar-consola").isVisible()) {
      await page.getByTestId("boton-ocultar-consola").click();
      await page.getByTestId("pestana-consola").click();
    }
    await page.waitForFunction((previo) => window.__debug.resultadoTurno !== previo, antes, { timeout: 120000 });
    await page.waitForFunction(() => window.__debug.control?.puedeDisparar === true, undefined, { timeout: 120000 });

    const medida = await page.evaluate(() => ({
      interacciones: window.__debug.rendimiento!.interacciones,
      inp: window.__debug.rendimiento!.inp,
      modo: window.__debug.motor!.modo,
      aviso: (window as unknown as { __vioAvisoIA: string | null }).__vioAvisoIA,
    }));
    expect(medida.modo).toBe("trabajador");
    expect(medida.interacciones.length).toBeGreaterThanOrEqual(6);
    const lentas = medida.interacciones.filter((i) => i.duracion > LIMITE_MS || i.retrasoEntrada > LIMITE_MS);
    expect(lentas, JSON.stringify(lentas)).toEqual([]);
    expect(medida.inp).toBeLessThanOrEqual(LIMITE_MS);
    expect(medida.aviso).toMatch(/está apuntando…$/);
  });
}

test("res-4: sin Worker el juego sigue funcionando con el adaptador en línea", async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    delete (window as unknown as { Worker?: unknown }).Worker;
  });
  await entrarAPartida(page, 360, 640);
  expect(await page.evaluate(() => window.__debug.motor!.modo)).toBe("en-linea");
  const antes = await page.evaluate(() => window.__debug.resultadoTurno);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((previo) => window.__debug.resultadoTurno !== previo, antes, { timeout: 120000 });
  await page.waitForFunction(() => window.__debug.control?.puedeDisparar === true, undefined, { timeout: 120000 });
});
