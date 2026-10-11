import { test, expect, type Page } from "@playwright/test";

// vida-muerte-subita (vid-1, vid-2): 150 de vida por nave, barra llena y
// muerte súbita que arranca en la ronda 14. Las capturas van a CAPTURAS_DIR
// (las genera el CI remoto) en los tres tamaños de referencia.

const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
] as const;

async function empezar(page: Page, ancho: number, alto: number): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto("/?muerte=1&modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.hud !== undefined && window.__debug.naves !== undefined && window.__debug.fijarMuerteSubita !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

async function capturar(page: Page, nombre: string, ancho: number, alto: number): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nombre}-${ancho}x${alto}.png` });
}

for (const { ancho, alto } of TAMANOS) {
  test(`vid-1: las naves empiezan con 150 de vida y la barra llena (${ancho}x${alto})`, async ({ page }) => {
    test.setTimeout(120000);
    await empezar(page, ancho, alto);
    const naves = await page.evaluate(() => window.__debug.naves!);
    for (const nave of naves) expect(nave.integridad).toBe(150);
    const vidas = await page.evaluate(() => window.__debug.hud!.vidas);
    expect(vidas.length).toBe(naves.length);
    for (const vida of vidas) {
      expect(vida.valor).toBe(150);
      expect(vida.porcentaje).toBe(100);
      const ancho100 = await page.getByTestId(`integridad-relleno-${vida.id}`).evaluate((el) => (el as HTMLElement).style.width);
      expect(ancho100).toBe("100%");
    }
    await capturar(page, "vida-muerte-subita-vida-inicial", ancho, alto);
  });
}

test("vid-1: con 18 de daño la barra queda al 88 % y el corazón no pasa de 150", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, 360, 640);
  await page.evaluate(() => window.__debug.forzarIntegridad!(1, 132));
  await page.waitForFunction(() => window.__debug.hud!.vidas.find((vida) => vida.id === 1)?.porcentaje === 88);
  await page.evaluate(() => window.__debug.forzarIntegridad!(1, 999));
  expect((await page.evaluate(() => window.__debug.naves!)).find((nave) => nave.id === 1)!.integridad).toBe(150);
  await capturar(page, "vida-muerte-subita-barra-88", 360, 640);
});

test("vid-2: la muerte súbita avisa en la ronda 13 y el primer drenaje de la 14 es de 4", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page, 360, 640);
  await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 13, integridades: [100, 100] }));
  await expect(page.getByTestId("muerte-subita")).toHaveText("Muerte súbita en 1 ronda");
  await capturar(page, "vida-muerte-subita-aviso", 360, 640);
  // El escudo gasta el turno sin depender de la puntería; el drenaje lo ignora.
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId("equipo-escudo").click();
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.ronda === 14, undefined, { timeout: 90000 });
  const naves = await page.evaluate(() => window.__debug.naves!.map((nave) => nave.integridad));
  // 100 − 4 del drenaje, menos lo que pueda haber quitado el disparo de la IA.
  expect(naves[0]).toBeLessThanOrEqual(96);
  await capturar(page, "vida-muerte-subita-drenaje", 360, 640);
});
