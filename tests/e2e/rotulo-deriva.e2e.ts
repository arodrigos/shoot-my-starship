import { test, expect, type Page } from "@playwright/test";

// rd-1..rd-3: el rótulo «Vacío…» se ve 4 s desde que el tablero queda a la
// vista y después se retira, para que deje de tapar planetas (#199).
const VIEWPORTS = [
  { nombre: "360x640", ancho: 360, alto: 640 },
  { nombre: "820x1180", ancho: 820, alto: 1180 },
  { nombre: "1180x820", ancho: 1180, alto: 820 },
];

// Solo para dejar evidencia visual al gatekeeper; el CI no define la variable.
async function capturar(page: Page, nombre: string): Promise<void> {
  const carpeta = process.env.CAPTURAS_DIR;
  if (carpeta !== undefined) await page.screenshot({ path: `${carpeta}/${nombre}.png` });
}

async function entrarYCerrarAyuda(page: Page, ruta = "/"): Promise<void> {
  await page.goto(ruta);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.indicadorDeriva !== undefined);
  await page.getByTestId("ayuda-cerrar").click();
}

for (const vp of VIEWPORTS) {
  test(`rd-1: el rótulo se ve al cerrar la ayuda y se desvanece solo (${vp.nombre})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.ancho, height: vp.alto });
    await page.goto("/");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.indicadorDeriva !== undefined && window.__debug.planetas !== undefined);

    // Con la ayuda encima el reloj del rótulo no corre.
    await page.waitForTimeout(500);
    expect((await page.evaluate(() => window.__debug.indicadorDeriva!)).msVisible).toBe(0);

    await page.getByTestId("ayuda-cerrar").click();
    await page.waitForFunction(() => window.__debug.indicadorDeriva!.msVisible > 200, undefined, { polling: 100 });
    const visible = await page.evaluate(() => window.__debug.indicadorDeriva!);
    expect(visible.visible).toBe(true);
    expect(visible.alfa).toBe(1);
    expect(visible.etiqueta).toContain("Vacío");
    await capturar(page, `rotulo-deriva-espacial-1-rotulo-visible-${vp.nombre}`);

    await page.waitForFunction(() => window.__debug.indicadorDeriva!.msVisible >= 4600, undefined, { timeout: 30000, polling: 100 });
    const oculto = await page.evaluate(() => window.__debug.indicadorDeriva!);
    expect(oculto.visible).toBe(false);
    expect(oculto.alfa).toBe(0);
    expect((await page.evaluate(() => window.__debug.planetas!)).length).toBeGreaterThanOrEqual(3);
    await capturar(page, `rotulo-deriva-espacial-1-rotulo-desvanecido-${vp.nombre}`);
  });
}

test("rd-1: el rótulo no reaparece tras un disparo que completa el turno", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await entrarYCerrarAyuda(page);
  await page.waitForFunction(() => window.__debug.indicadorDeriva!.msVisible >= 4600, undefined, { timeout: 30000, polling: 100 });
  await page.waitForFunction(() => window.__debug.control?.puedeDisparar === true);
  const turnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  await page.waitForFunction((antes) => (window.__debug.numeroTurno ?? 0) > antes, turnoAntes, { timeout: 60000 });
  expect((await page.evaluate(() => window.__debug.indicadorDeriva!)).visible).toBe(false);
});

test("rd-2: con movimiento reducido el alfa solo vale 0 o 1", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 640 });
  await entrarYCerrarAyuda(page);

  const muestras: { alfa: number; msVisible: number }[] = [];
  for (let i = 0; i < 120; i++) {
    const lectura = await page.evaluate(() => window.__debug.indicadorDeriva!);
    muestras.push({ alfa: lectura.alfa, msVisible: lectura.msVisible });
    if (lectura.msVisible >= 4600) break;
    await page.waitForTimeout(50);
  }
  expect(muestras.at(-1)!.msVisible).toBeGreaterThanOrEqual(4600);
  for (const muestra of muestras) expect([0, 1]).toContain(muestra.alfa);
  // Nunca está a 0 antes de los 4 s ni a 1 después: el corte es único y a tiempo.
  for (const muestra of muestras) {
    if (muestra.msVisible < 4000) expect(muestra.alfa).toBe(1);
    if (muestra.msVisible >= 4300) expect(muestra.alfa).toBe(0);
  }
});

test("rd-3: en suelo plano (?mapa=) la flecha y su etiqueta no se desvanecen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await entrarYCerrarAyuda(page, "/?mapa=desguace-del-ecuador");
  await page.waitForFunction(() => window.__debug.indicadorDeriva!.msVisible >= 6000, undefined, { timeout: 30000, polling: 100 });
  const lectura = await page.evaluate(() => window.__debug.indicadorDeriva!);
  expect(lectura.visible).toBe(true);
  expect(lectura.alfa).toBe(1);
  expect((await page.evaluate(() => window.__debug.deriva!)).sentido).not.toBe(0);
  await capturar(page, "rotulo-deriva-espacial-1-suelo-plano-360x640");
});
