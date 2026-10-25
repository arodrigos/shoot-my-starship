import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

// Las capturas van a la carpeta del run si CAPTURAS_DIR la define; en el CI
// quedan junto al informe de Playwright.
const CARPETA = process.env.CAPTURAS_DIR ?? "test-results/capturas";
const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
] as const;

async function abrir(page: Page, ancho: number, alto: number, query: string): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto(`/?${query}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.rendimiento !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

async function captura(page: Page, nombre: string, ancho: number, alto: number): Promise<void> {
  await page.screenshot({ path: path.join(CARPETA, `medicion-dispositivo-1-${nombre}-${ancho}x${alto}.png`) });
}

test("md-1: sin ?rendimiento=1 no existe ni el recuadro ni el botón", async ({ page }) => {
  await abrir(page, 360, 640, "mapa=calma-de-los-restos");
  await expect(page.getByTestId("hud-rendimiento")).toHaveCount(0);
  await expect(page.getByTestId("medir-rendimiento")).toHaveCount(0);
  expect(await page.evaluate(() => window.__debug.medicion === undefined || window.__debug.medicion!().estado === "inactiva")).toBe(true);
});

for (const { ancho, alto } of TAMANOS) {
  test(`md-1: el botón «Medir» mide ≥44x44, tiene su aria-label y recibe el toque (${ancho}x${alto})`, async ({ page }) => {
    await abrir(page, ancho, alto, "mapa=calma-de-los-restos&rendimiento=1");
    const boton = page.getByRole("button", { name: "Medir rendimiento" });
    await expect(boton).toBeVisible();
    const caja = (await boton.boundingBox())!;
    expect(caja.width).toBeGreaterThanOrEqual(44);
    expect(caja.height).toBeGreaterThanOrEqual(44);
    await captura(page, "md-1-boton", ancho, alto);
  });
}

test("md-2/3/4/6/7: «Medir» juega solo, entrega el resumen sin segundo toque, sin red y sin tocar la partida guardada", async ({ page, context }) => {
  test.setTimeout(240000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  const peticiones: string[] = [];
  await abrir(page, 360, 640, "mapa=calma-de-los-restos&rendimiento=1");
  // La partida guardada se compara byte a byte antes y después (md-6).
  const guardadoAntes = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  page.on("request", (r) => {
    if (!r.url().startsWith("data:") && !r.url().startsWith("blob:")) peticiones.push(r.url());
  });
  await page.getByTestId("medir-rendimiento").click();
  await expect(page.getByTestId("franja-medicion")).toContainText(/Midiendo · tramo \d de 5/, { timeout: 60000 });
  await expect(page.getByTestId("cancelar-medicion")).toBeVisible();
  await captura(page, "md-2-midiendo", 360, 640);

  await expect(page.getByTestId("panel-medicion")).toBeVisible({ timeout: 200000 });
  const estado = await page.evaluate(() => window.__debug.medicion!().estado);
  expect(["terminada", "incompleta"]).toContain(estado);
  const texto = await page.getByTestId("texto-medicion").inputValue();
  expect(texto).toContain("Medición de rendimiento");
  expect(texto).toContain("INP de tus toques (no del recorrido)");
  expect(texto).toMatch(/Pepinazo:/);
  expect(texto).not.toMatch(/NaN|undefined|Infinity|http|\/home/);
  await expect(page.getByTestId("texto-medicion")).toHaveAttribute("readonly", "");
  // md-3: cabe en 360x640
  const caja = (await page.getByTestId("panel-medicion").boundingBox())!;
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(360);
  expect(caja.y + caja.height).toBeLessThanOrEqual(640);
  await captura(page, "md-3-resumen", 360, 640);
  // md-4: copia automática o aviso de que hay que pulsar «Copiar»
  await expect(page.getByTestId("estado-copia")).toContainText(/Copiado al portapapeles|No se pudo copiar solo: pulsa Copiar o selecciona el texto/);
  await captura(page, "md-4-copia", 360, 640);
  // md-7: ninguna petición de red durante la medición
  expect(peticiones).toEqual([]);
  // md-6: el guardado no cambia y «Cerrar» vuelve a la portada
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()))).toBe(guardadoAntes);
  await page.getByTestId("cerrar-medicion").click();
  await expect(page.getByTestId("boton-jugar")).toBeVisible({ timeout: 30000 });
});

test("md-8: «Cancelar» deja el panel «Medición cancelada» con el estado 'cancelada'", async ({ page }) => {
  test.setTimeout(120000);
  await abrir(page, 360, 640, "mapa=calma-de-los-restos&rendimiento=1");
  await page.getByTestId("medir-rendimiento").click();
  await expect(page.getByTestId("cancelar-medicion")).toBeVisible({ timeout: 60000 });
  await page.getByTestId("cancelar-medicion").click();
  await expect(page.getByTestId("panel-medicion")).toContainText("Medición cancelada", { timeout: 30000 });
  expect(await page.evaluate(() => window.__debug.medicion!().estado)).toBe("cancelada");
  expect(await page.getByTestId("texto-medicion").inputValue()).toContain("INCOMPLETA");
  await captura(page, "md-8-cancelada", 360, 640);
});
