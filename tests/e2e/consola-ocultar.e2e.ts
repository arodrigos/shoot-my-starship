import { test, expect, type Page } from "@playwright/test";

// Regresión del BUG 0 (bug_indice 0): la consola plegada no ofrecía «Ocultar
// controles», así que no había forma de despejar el campo desde mínima.
const VIEWPORTS = [
  { ancho: 360, alto: 640 },
  { ancho: 1180, alto: 820 },
];

async function entrarAPartida(page: Page, ancho: number, alto: number): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
}

for (const vp of VIEWPORTS) {
  test(`con-1 y con-2 (bug 0): ${vp.ancho}x${vp.alto}, desde mínima se oculta y el campo queda despejado`, async ({ page }) => {
    test.setTimeout(120000);
    await entrarAPartida(page, vp.ancho, vp.alto);
    const nombre = `capturas/bug-consola-1-${vp.ancho}x${vp.alto}`;

    await page.getByTestId("boton-plegar-consola").click();
    await expect(page.getByTestId("barra-minima")).toBeVisible();
    await expect(page.getByTestId("disparar")).toBeVisible();
    for (const id of ["boton-plegar-consola", "boton-ocultar-consola"]) {
      const c = (await page.getByTestId(id).boundingBox())!;
      expect(c.width, id).toBeGreaterThanOrEqual(44);
      expect(c.height, id).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByTestId("boton-ocultar-consola")).toHaveAccessibleName("Ocultar controles");
    await page.screenshot({ path: `${nombre}-minima.png` });

    await page.getByTestId("boton-ocultar-consola").click();
    expect(await page.evaluate(() => window.__debug.consola?.estado)).toBe("oculta");
    const consola = (await page.getByTestId("consola").boundingBox())!;
    expect(Math.abs(consola.width - 48)).toBeLessThanOrEqual(2);
    expect(Math.abs(consola.height - 48)).toBeLessThanOrEqual(2);
    // Rejilla de 9 puntos sobre el campo, fuera de la pestaña: solo el lienzo.
    const tapados = await page.evaluate(
      ({ ancho, alto, pestana }) => {
        const malos: string[] = [];
        for (const fx of [0.2, 0.5, 0.8]) {
          for (const fy of [0.2, 0.5, 0.8]) {
            const x = ancho * fx;
            const y = alto * fy;
            if (x >= pestana.x && x <= pestana.x + pestana.width && y >= pestana.y && y <= pestana.y + pestana.height) continue;
            const el = document.elementFromPoint(x, y);
            if (el?.tagName !== "CANVAS") malos.push(`${x},${y}:${el?.tagName}`);
          }
        }
        return malos;
      },
      { ancho: vp.ancho, alto: vp.alto, pestana: consola },
    );
    expect(tapados).toEqual([]);
    await page.screenshot({ path: `${nombre}-oculta.png` });

    await page.getByTestId("pestana-consola").click();
    expect(await page.evaluate(() => window.__debug.consola?.estado)).toBe("desplegada");
    await expect(page.getByTestId("disparar")).toBeVisible();
    await page.screenshot({ path: `${nombre}-desplegada.png` });
  });
}
