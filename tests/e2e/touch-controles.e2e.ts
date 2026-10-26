import { test, expect, type CDPSession, type Page } from "@playwright/test";
import path from "node:path";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { UMBRAL_POTENCIA_DISPERSION_VISIBLE } from "@/sim/balistica/dispersionPotencia";

// #753 y #752 (probador): con toque real (CDP, no ratón) el aviso de precisión
// no mueve los controles y se va al bajar la potencia, y la barra de ángulo
// mueve el ángulo y deja la potencia donde estaba.
test.use({ hasTouch: true });

const CARPETA = process.env.CAPTURAS_DIR ?? "test-results/capturas";
const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 1180, alto: 820 },
] as const;

async function toque(cdp: CDPSession, tipo: "touchStart" | "touchMove" | "touchEnd", x: number, y: number): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints: tipo === "touchEnd" ? [] : [{ x, y, id: 0 }] });
}

async function arrastrarConDedo(page: Page, cdp: CDPSession, testId: string, desde: number, hasta: number): Promise<void> {
  const caja = (await page.getByTestId(testId).boundingBox())!;
  const y = caja.y + caja.height / 2;
  const x0 = caja.x + Math.max(1, desde * caja.width);
  const x1 = caja.x + Math.min(caja.width - 1, hasta * caja.width);
  await toque(cdp, "touchStart", x0, y);
  for (let i = 1; i <= 6; i++) await toque(cdp, "touchMove", x0 + ((x1 - x0) * i) / 6, y);
  await toque(cdp, "touchEnd", x1, y);
}

async function tocarConDedo(page: Page, cdp: CDPSession, testId: string, fraccion: number): Promise<void> {
  const caja = (await page.getByTestId(testId).boundingBox())!;
  const x = caja.x + fraccion * caja.width;
  const y = caja.y + caja.height / 2;
  await toque(cdp, "touchStart", x, y);
  await toque(cdp, "touchEnd", x, y);
}

const control = (page: Page) => page.evaluate(() => ({ angulo: window.__debug.control!.ajuste.anguloGrados, potencia: window.__debug.control!.ajuste.potencia }));

for (const { ancho, alto } of TAMANOS) {
  test(`touch-1 (#753): con la potencia alta el aviso no mueve los controles y se va al bajarla (${ancho}x${alto})`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/?mapa=calma-de-los-restos");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
    const cdp = await page.context().newCDPSession(page);

    // Potencia por debajo del umbral: sin aviso, y estas son las posiciones de referencia.
    await arrastrarConDedo(page, cdp, "barra-potencia", 0.1, 0.3);
    await expect(page.getByTestId("ayuda-dispersion")).toBeHidden();
    const antes = {
      disparar: (await page.getByTestId("disparar").boundingBox())!,
      angulo: (await page.getByTestId("barra-angulo").boundingBox())!,
      potencia: (await page.getByTestId("barra-potencia").boundingBox())!,
    };

    await arrastrarConDedo(page, cdp, "barra-potencia", 0.3, 0.99);
    await expect(page.getByTestId("ayuda-dispersion")).toBeVisible();
    expect((await control(page)).potencia).toBeGreaterThan(UMBRAL_POTENCIA_DISPERSION_VISIBLE);
    // Con el aviso a la vista, ningún control se ha movido ni se sale de la pantalla.
    for (const id of ["disparar", "angulo", "potencia"] as const) {
      const caja = (await page.getByTestId(id === "disparar" ? "disparar" : `barra-${id}`).boundingBox())!;
      expect(Math.abs(caja.y - antes[id].y), id).toBeLessThanOrEqual(0.5);
      expect(Math.abs(caja.height - antes[id].height), id).toBeLessThanOrEqual(0.5);
    }
    const disparar = (await page.getByTestId("disparar").boundingBox())!;
    expect(disparar.y + disparar.height).toBeLessThanOrEqual(alto);
    const aviso = (await page.getByTestId("ayuda-dispersion").boundingBox())!;
    expect(aviso.y).toBeGreaterThanOrEqual(0);
    // El aviso flota encima de los controles, nunca encima de «Disparar».
    expect(aviso.y + aviso.height).toBeLessThanOrEqual(antes.angulo.y + 0.5);
    await page.screenshot({ path: path.join(CARPETA, `touch-controles-1-aviso-${ancho}x${alto}.png`) });

    // #752: tocar y arrastrar la barra de ángulo con el aviso a la vista mueve el ángulo, no la potencia.
    const potenciaAlta = (await control(page)).potencia;
    const angulo = (fraccion: number): number => ANGULO_MINIMO_GRADOS + fraccion * (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
    await tocarConDedo(page, cdp, "barra-angulo", 0.8);
    await page.waitForFunction((esperado) => Math.abs(window.__debug.control!.ajuste.anguloGrados - esperado) <= 3, angulo(0.8));
    expect((await control(page)).potencia).toBe(potenciaAlta);
    await arrastrarConDedo(page, cdp, "barra-angulo", 0.2, 0.6);
    await page.waitForFunction((esperado) => Math.abs(window.__debug.control!.ajuste.anguloGrados - esperado) <= 3, angulo(0.6));
    expect((await control(page)).potencia).toBe(potenciaAlta);
    await page.screenshot({ path: path.join(CARPETA, `touch-controles-2-angulo-${ancho}x${alto}.png`) });

    // Al bajar de la potencia alta el aviso se retira solo.
    const fraccionBaja = (UMBRAL_POTENCIA_DISPERSION_VISIBLE - 21 - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
    await arrastrarConDedo(page, cdp, "barra-potencia", 0.9, fraccionBaja);
    await expect(page.getByTestId("ayuda-dispersion")).toBeHidden({ timeout: 5000 });
    const despues = (await page.getByTestId("disparar").boundingBox())!;
    expect(Math.abs(despues.y - antes.disparar.y)).toBeLessThanOrEqual(0.5);
    await page.screenshot({ path: path.join(CARPETA, `touch-controles-3-bajada-${ancho}x${alto}.png`) });
  });
}
