import { test, expect, type Page } from "@playwright/test";

// render-1: el mismo arrastre relativo (misma fracción del viewport, de
// 50%,80% a 20%,40%) debe producir el mismo ángulo, potencia e impacto en
// cualquier tamaño de pantalla -- el mismo contrato que andamiaje-1, pero
// para el gesto de apuntado en vez del toque simple.
async function arrastrarYLeerDisparo(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");

  const inicio = { x: viewport.width * 0.5, y: viewport.height * 0.8 };
  const fin = { x: viewport.width * 0.2, y: viewport.height * 0.4 };

  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fin.x, fin.y, { steps: 10 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.ultimoDisparo !== undefined);
  return page.evaluate(() => window.__debug.ultimoDisparo);
}

test("el mismo arrastre relativo produce el mismo ángulo, potencia e impacto en móvil y en escritorio", async ({
  page,
}) => {
  const enMovil = await arrastrarYLeerDisparo(page, { width: 360, height: 740 });
  const enEscritorio = await arrastrarYLeerDisparo(page, { width: 1280, height: 800 });

  expect(enMovil).toBeDefined();
  expect(enEscritorio).toBeDefined();

  expect(Math.abs(enMovil!.anguloGrados - enEscritorio!.anguloGrados)).toBeLessThanOrEqual(0.2);
  expect(Math.abs(enMovil!.potencia - enEscritorio!.potencia)).toBeLessThanOrEqual(1);
  expect(Math.abs(enMovil!.impacto.x - enEscritorio!.impacto.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(enMovil!.impacto.y - enEscritorio!.impacto.y)).toBeLessThanOrEqual(2);
});
