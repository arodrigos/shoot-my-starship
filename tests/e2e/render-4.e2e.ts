import { test, expect } from "@playwright/test";

const MUNDO_ANCHO = 1920;
const MUNDO_ALTO = 1080;

// render-4: a estos tres tamaños el lienzo debe llenar el viewport sin
// barras de desplazamiento, y el campo de batalla entero (las dos naves y
// el terreno entre ellas) tiene que caber en la vista de cámara -- se
// comprueba contra el rectángulo de mundo que la cámara reporta, no contra
// una captura, porque "cabe sin recorte" es una propiedad geométrica
// exacta, no una impresión visual.
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
];

for (const viewport of VIEWPORTS) {
  test(`a ${viewport.width}x${viewport.height} el lienzo llena el viewport y el campo de batalla entero es visible`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.camara !== undefined);

    const sinScroll = await page.evaluate(() => ({
      ancho: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      alto: document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
    }));
    expect(sinScroll.ancho).toBe(true);
    expect(sinScroll.alto).toBe(true);

    const rectangulo = await page.evaluate(() => {
      const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement;
      return lienzo.getBoundingClientRect();
    });
    // El lienzo (con su letterbox de Phaser.Scale.FIT) nunca desborda el
    // viewport: si desbordase, sería la causa mecánica de una barra de
    // desplazamiento.
    expect(rectangulo.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(rectangulo.height).toBeLessThanOrEqual(viewport.height + 1);

    const camara = await page.evaluate(() => window.__debug.camara!);
    const EPSILON = 1;
    expect(camara.x).toBeLessThanOrEqual(EPSILON);
    expect(camara.y).toBeLessThanOrEqual(EPSILON);
    expect(camara.x + camara.ancho).toBeGreaterThanOrEqual(MUNDO_ANCHO - EPSILON);
    expect(camara.y + camara.alto).toBeGreaterThanOrEqual(MUNDO_ALTO - EPSILON);

    const naves = await page.evaluate(() => window.__debug.naves!);
    for (const nave of naves) {
      expect(nave.x).toBeGreaterThanOrEqual(camara.x);
      expect(nave.x).toBeLessThanOrEqual(camara.x + camara.ancho);
    }
  });
}
