import { test, expect, type Page } from "@playwright/test";
import { instalarVibracionFalsa, leerVibracionesFalsas, type ModoVibracionFalsa } from "../utils/vibracionFalsa";
import { comprobarContrasteHud } from "../utils/axeHud";
import { PATRONES_VIBRACION } from "../../src/juego/control/vibracion";
import { abrirAjustes } from "./utilesControl";

const ORDEN_SIN_VIBRACION = ["toggle-sacudida", "toggle-rastro", "toggle-silenciado", "toggle-musica", "toggle-voz", "toggle-texto-grande"];

// Solo para dejar evidencia visual al gatekeeper; el CI no define la variable.
async function capturar(page: Page, nombre: string): Promise<void> {
  const carpeta = process.env.CAPTURAS_DIR;
  if (carpeta !== undefined) await page.screenshot({ path: `${carpeta}/${nombre}.png` });
}

async function entrar(page: Page): Promise<void> {
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.vibracion !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
}

const idsDelPanel = (page: Page) =>
  page.getByTestId("panel-ajustes").locator("button[data-testid]").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-testid")));

test.describe("móvil con vibración (360x640)", () => {
  test.use({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });

  test("aj-1: texto, ayuda, apagar, recordar al recargar y volver a encender", async ({ page }) => {
    test.setTimeout(120000);
    await instalarVibracionFalsa(page, "con-api");
    await entrar(page);
    await abrirAjustes(page);
    const boton = page.getByTestId("toggle-vibracion");
    await expect(boton).toHaveText("Vibración: On");
    await expect(boton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("panel-ajustes")).toContainText("Vibra al disparar y cuando un tiro alcanza una nave");
    const ids = await idsDelPanel(page);
    expect(ids.indexOf("toggle-vibracion")).toBe(ids.indexOf("toggle-sacudida") + 1);

    await boton.click();
    await expect(boton).toHaveText("Vibración: Off", { timeout: 200 });
    await expect(boton).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => localStorage.getItem("vibracion:activa"))).toBe("0");
    await page.getByTestId("cerrar-ajustes").click();
    await page.getByTestId("disparar").click();
    await page.waitForTimeout(500);
    expect(await leerVibracionesFalsas(page)).toHaveLength(0);

    await page.reload();
    await entrar(page);
    await abrirAjustes(page);
    await expect(page.getByTestId("toggle-vibracion")).toHaveText("Vibración: Off");
    expect(await page.evaluate(() => localStorage.getItem("vibracion:activa"))).toBe("0");

    await page.getByTestId("toggle-vibracion").click();
    await expect(page.getByTestId("toggle-vibracion")).toHaveText("Vibración: On");
    await page.getByTestId("cerrar-ajustes").click();
    await page.evaluate(() => (window.__vibracionesFalsas = []));
    await page.getByTestId("disparar").click();
    await expect.poll(async () => (await leerVibracionesFalsas(page)).length).toBe(1);
  });

  test("aj-5: pasar a On da una llamada 'prueba' pegada al clic; pasar a Off no vibra", async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(() => localStorage.setItem("vibracion:activa", "0"));
    await instalarVibracionFalsa(page, "con-api");
    await entrar(page);
    await abrirAjustes(page);
    await page.evaluate(() => {
      document.addEventListener("click", () => ((window as unknown as { __clic: number }).__clic = performance.now()), true);
    });
    await page.getByTestId("toggle-vibracion").click();
    await expect.poll(async () => (await leerVibracionesFalsas(page)).length).toBe(1);
    const [v] = await leerVibracionesFalsas(page);
    expect(v.patron).toEqual([...PATRONES_VIBRACION.prueba]);
    const clic = await page.evaluate(() => (window as unknown as { __clic: number }).__clic);
    expect(v.t - clic).toBeLessThanOrEqual(16);
    expect((await page.evaluate(() => window.__debug.vibracion!())).llamadas.map((l) => l.tipo)).toEqual(["prueba"]);
    await page.getByTestId("toggle-vibracion").click();
    await expect(page.getByTestId("toggle-vibracion")).toHaveText("Vibración: Off");
    await page.waitForTimeout(300);
    expect(await leerVibracionesFalsas(page)).toHaveLength(1);
  });

  test("aj-2: con reducir movimiento sale deshabilitada en Off, con el motivo, y no toca la preferencia", async ({ page }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await instalarVibracionFalsa(page, "con-api");
    await entrar(page);
    await abrirAjustes(page);
    const boton = page.getByTestId("toggle-vibracion");
    await expect(boton).toBeDisabled();
    await expect(boton).toHaveText("Vibración: Off");
    await expect(page.getByTestId("panel-ajustes")).toContainText("Apagada: tu sistema pide reducir el movimiento");
    expect(await page.evaluate(() => localStorage.getItem("vibracion:activa"))).toBeNull();
    await capturar(page, "vibracion-ajustes-aj-2-movimiento-reducido-360x640");
    expect(await leerVibracionesFalsas(page)).toHaveLength(0);
  });

  for (const grande of [false, true]) {
    test(`aj-4: Vibración y Cerrar se alcanzan, nada se sale (360x640, texto grande ${grande})`, async ({ page }) => {
      test.setTimeout(120000);
      if (grande) await page.addInitScript(() => localStorage.setItem("legibilidad:texto-grande", "1"));
      await instalarVibracionFalsa(page, "con-api");
      await entrar(page);
      await abrirAjustes(page);
      await capturar(page, `vibracion-ajustes-aj-4-360x640${grande ? "-texto-grande" : ""}`);
      for (const id of ["toggle-vibracion", "cerrar-ajustes"]) {
        const el = page.getByTestId(id);
        await el.scrollIntoViewIfNeeded();
        const esElPropio = await el.evaluate((nodo) => {
          const r = nodo.getBoundingClientRect();
          const tope = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return tope === nodo || nodo.contains(tope);
        });
        expect(esElPropio, id).toBe(true);
      }
      const panel = (await page.getByTestId("panel-ajustes").boundingBox())!;
      const vp = page.viewportSize()!;
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(vp.width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(vp.height);
      const scrollX = await page.getByTestId("panel-ajustes").evaluate((n) => n.scrollWidth - n.clientWidth);
      expect(scrollX).toBeLessThanOrEqual(0);
      const contraste = await comprobarContrasteHud(page, ["[data-testid=panel-ajustes]"]);
      expect(contraste.violaciones, contraste.detalle.join("\n")).toBe(0);
    });
  }
});

for (const vp of [
  { ancho: 820, alto: 1180, modo: "sin-api" as ModoVibracionFalsa, tactil: true },
  { ancho: 1180, alto: 820, modo: "con-api" as ModoVibracionFalsa, tactil: false },
]) {
  test.describe(`sin soporte (${vp.ancho}x${vp.alto}, ${vp.modo}, táctil ${vp.tactil})`, () => {
    test.use({ viewport: { width: vp.ancho, height: vp.alto }, hasTouch: vp.tactil });

    test("aj-3: el panel es el de antes, sin fila «Vibración»", async ({ page }) => {
      test.setTimeout(120000);
      await instalarVibracionFalsa(page, vp.modo);
      await entrar(page);
      await abrirAjustes(page);
      await expect(page.getByTestId("toggle-vibracion")).toHaveCount(0);
      const ids = (await idsDelPanel(page)).filter((id) => id !== "historico-bromas-toggle");
      expect(ids).toEqual([...ORDEN_SIN_VIBRACION, "cerrar-ajustes"]);
      await capturar(page, `vibracion-ajustes-aj-3-${vp.ancho}x${vp.alto}`);
      const panel = (await page.getByTestId("panel-ajustes").boundingBox())!;
      expect(panel.x + panel.width).toBeLessThanOrEqual(vp.ancho);
      expect(panel.y + panel.height).toBeLessThanOrEqual(vp.alto);
    });
  });
}

test.describe("capturas del panel con vibración en tableta", () => {
  for (const [ancho, alto] of [[820, 1180], [1180, 820]]) {
    test.describe(`${ancho}x${alto}`, () => {
      test.use({ viewport: { width: ancho, height: alto }, hasTouch: true });
      test(`aj-4: el panel se ve entero a ${ancho}x${alto}`, async ({ page }) => {
        test.setTimeout(120000);
        await instalarVibracionFalsa(page, "con-api");
        await entrar(page);
        await abrirAjustes(page);
        await expect(page.getByTestId("toggle-vibracion")).toBeVisible();
        await capturar(page, `vibracion-ajustes-aj-4-${ancho}x${alto}`);
        const panel = (await page.getByTestId("panel-ajustes").boundingBox())!;
        expect(panel.x + panel.width).toBeLessThanOrEqual(ancho);
        expect(panel.y + panel.height).toBeLessThanOrEqual(alto);
      });
    });
  }
});
