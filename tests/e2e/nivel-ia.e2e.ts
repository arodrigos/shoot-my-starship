import { test, expect, type Page } from "@playwright/test";

const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
] as const;

async function capturar(page: Page, nombre: string, ancho: number, alto: number): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nombre}-${ancho}x${alto}.png` });
}

async function esperarPartida(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug?.naves !== undefined && window.__debug?.controladores !== undefined, undefined, { timeout: 120000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

// niv-2: el selector está en la portada, «Normal» viene marcado, las descripciones
// de los rivales no hablan de dificultad y el nivel elegido se recuerda.
for (const { ancho, alto } of TAMANOS) {
  test(`niv-2: la portada ofrece Nivel con Normal marcado y lo recuerda (${ancho}x${alto})`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/");
    await expect(page.getByTestId("nivel-normal")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("nivel-facil")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("nivel-dificil")).toHaveAttribute("aria-pressed", "false");
    await page.getByTestId("nivel-dificil").scrollIntoViewIfNeeded();
    await capturar(page, "niv-2-portada", ancho, alto);
    await page.getByTestId("nivel-facil").click();
    await expect(page.getByTestId("nivel-facil")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("boton-jugar").click();
    await page.reload();
    await expect(page.getByTestId("nivel-facil")).toHaveAttribute("aria-pressed", "true");
  });
}

test("niv-2: un valor inválido guardado en el almacenamiento cae a Normal", async ({ page }) => {
  await page.addInitScript(() => {
    const clave = "partida-completa:progreso";
    window.localStorage.setItem(clave, JSON.stringify({ version: 1, rivalId: null, nivelIA: "imposible", ultimaPartida: null }));
  });
  await page.goto("/");
  await expect(page.getByTestId("nivel-normal")).toHaveAttribute("aria-pressed", "true");
});

// niv-5: un único nivel para todos los rivales de IA y la etiqueta lo dice.
for (const { ancho, alto } of TAMANOS) {
  test(`niv-5: todos los rivales juegan al nivel elegido y la etiqueta lo muestra (${ancho}x${alto})`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/");
    await page.getByTestId("humanos-1").click();
    await page.getByTestId("ias-2").click();
    await page.getByTestId("nivel-dificil").click();
    await page.getByTestId("boton-jugar").click();
    await esperarPartida(page);
    const ias = (await page.evaluate(() => window.__debug.controladores!)).filter((c) => c.tipo === "ia");
    expect(ias).toHaveLength(2);
    for (const ia of ias) expect(ia.nivel).toBe("dificil");
    await expect(page.getByTestId("integridad-nave-1").getByRole("progressbar", { name: /· Difícil$/ })).toBeVisible();
    await capturar(page, "niv-5-partida-dificil", ancho, alto);
  });
}
