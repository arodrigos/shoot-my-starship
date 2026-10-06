import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const VIEWPORTS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
];

async function entrarAPartida(page: Page, ancho: number, alto: number, ruta = "/"): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto(ruta);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
}

for (const vp of VIEWPORTS) {
  test(`pan-1: ${vp.ancho}x${vp.alto}, el lienzo ocupa el viewport y plegar no redimensiona ni recalcula el mundo`, async ({ page }) => {
    test.setTimeout(120000);
    await entrarAPartida(page, vp.ancho, vp.alto);
    const antes = await page.evaluate(() => ({ resize: window.__debug.contadorResize, mundo: window.__debug.mundo }));

    const canvas = (await page.locator("#game-container canvas").boundingBox())!;
    expect(Math.abs(canvas.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(canvas.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(canvas.width - vp.ancho)).toBeLessThanOrEqual(1);
    expect(Math.abs(canvas.height - vp.alto)).toBeLessThanOrEqual(1);

    const consola = (await page.getByTestId("consola").boundingBox())!;
    expect(consola.height).toBeLessThanOrEqual(vp.alto * 0.45 + 1);

    const boton = page.getByTestId("boton-plegar-consola");
    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "false");

    const despues = await page.evaluate(() => ({ resize: window.__debug.contadorResize, mundo: window.__debug.mundo }));
    expect(despues).toEqual(antes);
    const canvasDespues = (await page.locator("#game-container canvas").boundingBox())!;
    expect(canvasDespues).toEqual(canvas);
  });
}

test("pan-3: el botón de plegar mide ≥ 48×48, cambia de etiqueta, recuerda el estado y la consola no tiene violaciones serias de axe", async ({ page }) => {
  test.setTimeout(120000);
  await entrarAPartida(page, 360, 640);
  const boton = page.getByTestId("boton-plegar-consola");
  const caja = (await boton.boundingBox())!;
  expect(caja.width).toBeGreaterThanOrEqual(48);
  expect(caja.height).toBeGreaterThanOrEqual(48);
  await expect(boton).toHaveAccessibleName("Ocultar controles");

  const resultados = await new AxeBuilder({ page }).include('[data-testid="consola"]').analyze();
  const serias = resultados.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serias.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

  await boton.click();
  await expect(boton).toHaveAccessibleName("Mostrar controles");
  const cajaPlegada = (await boton.boundingBox())!;
  expect(cajaPlegada.width).toBeGreaterThanOrEqual(48);
  expect(cajaPlegada.height).toBeGreaterThanOrEqual(48);

  await page.reload();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await expect(page.getByTestId("boton-plegar-consola")).toHaveAttribute("aria-expanded", "false");
});

test("pan-6: iPad, viewport-fit=cover, contenedor = innerHeight, safe-area en la consola y manifest fullscreen", async ({ page }) => {
  test.setTimeout(120000);
  await entrarAPartida(page, 820, 1180);
  const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(meta).toContain("viewport-fit=cover");
  const alturas = await page.evaluate(() => ({
    contenedor: document.getElementById("game-container")!.getBoundingClientRect().height,
    ventana: window.innerHeight,
    estiloConsola: document.querySelector('[data-testid="consola"]')!.getAttribute("style") ?? "",
  }));
  expect(Math.abs(alturas.contenedor - alturas.ventana)).toBeLessThanOrEqual(1);
  expect(alturas.estiloConsola).toContain("env(safe-area-inset-bottom");
  const respuesta = await page.request.get("/manifest.webmanifest");
  expect(respuesta.ok()).toBe(true);
  expect((await respuesta.json()).display).toBe("fullscreen");
});

test("pan-7: 4 naves a 360x640, las pestañas no se cortan y la etiqueta de deriva no tapa ninguna nave", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("humanos-1").click();
  await page.getByTestId("ias-3").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForFunction(() => window.__debug.naves !== undefined && window.__debug.deriva !== undefined, undefined, { timeout: 120000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();

  for (let id = 0; id < 4; id++) {
    const ok = await page.getByTestId(`integridad-nave-${id}`).evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(ok, `pestaña ${id} cortada`).toBe(true);
  }

  const { naves, mundo, deriva } = await page.evaluate(() => ({ naves: window.__debug.naves!, mundo: window.__debug.mundo!, deriva: window.__debug.deriva! }));
  const canvas = (await page.locator("#game-container canvas").boundingBox())!;
  const escala = canvas.width / mundo.ancho;
  // La etiqueta empieza a 88 px CSS del borde y ocupa como mucho dos líneas de 16 px.
  const etiqueta = { izq: deriva.etiquetaBordeIzquierdoCssPx, der: deriva.etiquetaBordeDerechoCssPx, arriba: 88, abajo: 88 + 40 };
  for (const nave of naves) {
    const cx = canvas.x + nave.x * escala;
    const cy = canvas.y + (nave.y as number) * escala;
    const r = 22 * escala;
    const tapa = cx + r > etiqueta.izq && cx - r < etiqueta.der && cy + r > etiqueta.arriba && cy - r < etiqueta.abajo;
    expect(tapa, `la etiqueta tapa la nave ${nave.id}`).toBe(false);
  }
  await page.screenshot({ path: "capturas/pantalla-completa-16-hud-4-naves-360x640.png" });
});
