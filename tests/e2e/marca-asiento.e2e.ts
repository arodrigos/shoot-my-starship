import { test, expect, type Page } from "@playwright/test";
import { puntoLibreDeArrastre } from "./utilesApuntado";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

// marca-asiento: la mini-silueta del asiento como segundo canal además del
// color. Se juega por la portada real, en el mapa sembrado de siempre.
const MAPA_SEMBRADO = "calma-de-los-restos";

async function empezar(page: Page, humanos: number, ias: number): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId(`humanos-${humanos}`).click();
  await page.getByTestId(`ias-${ias}`).click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

async function comprobarMarcas(page: Page, total: number): Promise<void> {
  const naves = await page.evaluate(() => window.__debug.naves!);
  expect(naves.length).toBe(total);
  const siluetas = new Set<string>();
  for (const nave of naves) {
    const marca = page.getByTestId(`integridad-marca-${nave.id}`);
    await expect(marca).toBeVisible();
    await expect(marca).toHaveAttribute("data-silueta", String(nave.silueta));
    await expect(marca.locator("polygon")).toHaveAttribute("fill", nave.colorAsiento);
    siluetas.add(String(nave.silueta));
    const caja = await page.getByTestId(`integridad-nave-${nave.id}`).evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(caja.sw).toBeLessThanOrEqual(caja.cw);
  }
  expect(siluetas.size).toBe(total);
  const vidas = await page.evaluate(() => window.__debug.hud!.vidas);
  for (const vida of vidas) expect(vida.silueta).toBe(naves.find((n) => n.id === vida.id)!.silueta);
}

async function dispararImpactoReal(page: Page): Promise<void> {
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  const ajuste = (await page.evaluate(() => window.__debug.control!.ajuste))!;
  const inicio = await puntoLibreDeArrastre(page);
  const fin = {
    x: inicio.x + ((solucion!.potencia - ajuste.potencia) / GANANCIA_POTENCIA) * 360,
    y: inicio.y - ((solucion!.anguloGrados - ajuste.anguloGrados) / GANANCIA_ANGULO_GRADOS) * 640,
  };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fin.x, fin.y, { steps: 10 });
  await page.mouse.up();
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, numeroTurnoAntes, { timeout: 120000 });
}

test("ma-1: cuatro pestañas, cuatro siluetas distintas del color de su asiento", async ({ page }) => {
  test.setTimeout(150000);
  await empezar(page, 2, 2);
  if (await page.getByTestId("relevo-confirmar").isVisible()) await page.getByTestId("relevo-confirmar").click();
  await comprobarMarcas(page, 4);
});

test("ma-1: con dos naves las dos pestañas también llevan su marca", async ({ page }) => {
  test.setTimeout(150000);
  await empezar(page, 1, 1);
  await comprobarMarcas(page, 2);
});

test("ma-2: el número de daño lleva la silueta del tirador", async ({ page }) => {
  test.setTimeout(150000);
  await empezar(page, 1, 1);
  await dispararImpactoReal(page);
  const numero = await page
    .waitForFunction(() => window.__debug.efectosVisibles?.find((efecto) => efecto.tipo === "numero-danio") ?? null, undefined, { timeout: 5000, polling: 25 })
    .then((handle) => handle.jsonValue());
  expect(numero.valor).toBeGreaterThan(0);
  const tirador = (await page.evaluate(() => window.__debug.naves!))[0];
  expect(numero.silueta).toBe(tirador.silueta);
  expect(numero.color).toBe(tirador.colorAsiento);
});

for (const condicion of ["achromatopsia", "deuteranopia", "protanopia", "tritanopia"] as const) {
  test(`ma-3: con ${condicion} emulada las pestañas siguen distinguiéndose por la forma`, async ({ page }) => {
    test.setTimeout(150000);
    await empezar(page, 2, 2);
    if (await page.getByTestId("relevo-confirmar").isVisible()) await page.getByTestId("relevo-confirmar").click();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedVisionDeficiency", { type: condicion });
    await comprobarMarcas(page, 4);
  });
}

test("ma-4: con movimiento reducido no hay número flotante pero las marcas siguen", async ({ page }) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await empezar(page, 1, 1);
  await dispararImpactoReal(page);
  const hay = await page.evaluate(() => (window.__debug.efectosVisibles ?? []).some((efecto) => efecto.tipo === "numero-danio"));
  expect(hay).toBe(false);
  await comprobarMarcas(page, 2);
});
