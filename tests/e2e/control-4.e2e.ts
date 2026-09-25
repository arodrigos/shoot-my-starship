import { test, expect, type Page } from "@playwright/test";

function distanciaAPunto(caja: { x: number; y: number; width: number; height: number }, punto: { x: number; y: number }): number {
  const cx = Math.max(caja.x, Math.min(punto.x, caja.x + caja.width));
  const cy = Math.max(caja.y, Math.min(punto.y, caja.y + caja.height));
  return Math.hypot(punto.x - cx, punto.y - cy);
}

async function distanciasEnPunto(page: Page, punto: { x: number; y: number }): Promise<{ reticulo: number; preview: number }> {
  await page.mouse.move(punto.x, punto.y);
  await page.mouse.down();
  await page.mouse.up();

  const cajaReticulo = await page.getByTestId("reticulo").boundingBox();
  const cajaPreview = await page.getByTestId("preview-trayectoria").boundingBox();
  return {
    reticulo: distanciaAPunto(cajaReticulo!, punto),
    preview: distanciaAPunto(cajaPreview!, punto),
  };
}

// control-4: el retículo y la previsualización de trayectoria quedan a al
// menos 60px CSS del punto de contacto, comprobado en 10 posiciones
// repartidas por la mitad inferior de la pantalla (donde ocurre el
// arrastre) -- así el dedo nunca los tapa.
test("el retículo y la previsualización quedan a >=60px CSS del punto de contacto en la mitad inferior", async ({
  page,
}) => {
  // Ver control-1: WebGL por software en este host puede dejar 30s por
  // defecto justos para 10 gestos, sin que haya nada roto.
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const fracciones = [
    { x: 0.1, y: 0.55 },
    { x: 0.25, y: 0.6 },
    { x: 0.5, y: 0.55 },
    { x: 0.75, y: 0.6 },
    { x: 0.9, y: 0.55 },
    { x: 0.1, y: 0.95 },
    { x: 0.3, y: 0.8 },
    { x: 0.5, y: 0.9 },
    { x: 0.7, y: 0.8 },
    { x: 0.9, y: 0.95 },
  ];

  for (const fraccion of fracciones) {
    const punto = { x: 390 * fraccion.x, y: 844 * fraccion.y };
    const distancias = await distanciasEnPunto(page, punto);
    expect(distancias.reticulo, `retículo en (${punto.x},${punto.y})`).toBeGreaterThanOrEqual(60);
    expect(distancias.preview, `previsualización en (${punto.x},${punto.y})`).toBeGreaterThanOrEqual(60);
  }
});
