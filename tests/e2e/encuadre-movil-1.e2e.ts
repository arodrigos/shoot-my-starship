import { test, expect } from "@playwright/test";

// encuadre-movil-1: antes de este bloque, Phaser.Scale.FIT letterboxeaba el
// mundo fijo 16:9 dentro del 58% de alto que le reserva layout-dos-zonas --
// a 360x640 eso dejaba ~34% del alto en franjas negras (documentado en el
// criterio). Ahora el mundo se reconfigura al aspecto real del contenedor,
// así que el lienzo debería llenarlo sin dejar franja medible.
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 1280, height: 720 },
];
const UMBRAL_FRANJA_MUERTA = 0.02;

for (const viewport of VIEWPORTS) {
  test(`a ${viewport.width}x${viewport.height} el lienzo deja como máximo un 2% de franja muerta`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.mundo !== undefined);

    const { contRect, canvasRect } = await page.evaluate(() => {
      const contenedor = document.getElementById("game-container")!;
      const lienzo = document.querySelector("#game-container canvas")!;
      return {
        contRect: contenedor.getBoundingClientRect(),
        canvasRect: lienzo.getBoundingClientRect(),
      };
    });

    // Franja muerta = lo que el contenedor reserva y el lienzo NO llega a
    // cubrir, en cada eje -- el resto del viewport (la consola, bajo
    // layout-dos-zonas) es zona de HUD funcional, no franja muerta.
    const franjaAnchoPx = contRect.width - canvasRect.width;
    const franjaAltoPx = contRect.height - canvasRect.height;
    const franjaAnchoPct = franjaAnchoPx / viewport.width;
    const franjaAltoPct = franjaAltoPx / viewport.height;

    expect(franjaAnchoPct).toBeLessThanOrEqual(UMBRAL_FRANJA_MUERTA);
    expect(franjaAltoPct).toBeLessThanOrEqual(UMBRAL_FRANJA_MUERTA);

    await page.screenshot({ path: `test-results/encuadre-movil-1/${viewport.width}x${viewport.height}.png` });
  });
}
