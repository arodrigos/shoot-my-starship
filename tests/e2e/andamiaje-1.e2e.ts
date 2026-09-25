import { test, expect, type Page } from "@playwright/test";

// andamiaje-1: el mismo gesto relativo (misma fracción del viewport) debe
// producir la misma coordenada de mundo en cualquier tamaño de pantalla. La
// prueba no compara contra una constante fija -- compara los dos resultados
// entre sí, que es exactamente lo que el criterio exige.
async function tocarYLeerCoordenadaDeMundo(
  page: Page,
  viewport: { width: number; height: number },
  fraccion: { x: number; y: number },
) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");

  await page.mouse.click(viewport.width * fraccion.x, viewport.height * fraccion.y);

  return page.evaluate(() => window.__debug.ultimoPunto);
}

test("el mismo gesto relativo produce la misma coordenada de mundo en móvil y en escritorio", async ({
  page,
}) => {
  const fraccion = { x: 0.3, y: 0.6 };

  const enMovil = await tocarYLeerCoordenadaDeMundo(page, { width: 360, height: 740 }, fraccion);
  const enEscritorio = await tocarYLeerCoordenadaDeMundo(
    page,
    { width: 1280, height: 800 },
    fraccion,
  );

  expect(enMovil).toBeDefined();
  expect(enEscritorio).toBeDefined();

  const TOLERANCIA_MUNDO = 1;
  expect(Math.abs(enMovil!.x - enEscritorio!.x)).toBeLessThanOrEqual(TOLERANCIA_MUNDO);
  expect(Math.abs(enMovil!.y - enEscritorio!.y)).toBeLessThanOrEqual(TOLERANCIA_MUNDO);
});
