import { test, expect, type Page } from "@playwright/test";

// render-1: el mismo arrastre relativo (misma fracción del viewport, de
// 50%,80% a 20%,40%) más el mismo toque en "Disparar" debe producir el
// mismo ángulo, potencia e impacto en cualquier tamaño de pantalla.
//
// DESVIACIÓN (control-apuntado): la versión original de este test arrastraba
// y disparaba en el mismo gesto (tirachinas), el mecanismo que este bloque
// sustituye por apuntado indirecto con ganancia + botón explícito de
// disparo. Se reescribe con el mismo espíritu (invariancia entre viewports)
// sobre el mecanismo nuevo, en vez de dejar el test comprobando un gesto que
// ya no existe.
async function arrastrarYDispararYLeer(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);

  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const inicio = { x: viewport.width * 0.5, y: viewport.height * 0.8 };
  const fin = { x: viewport.width * 0.2, y: viewport.height * 0.4 };

  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fin.x, fin.y, { steps: 10 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  // publicarDisparoJugadorResuelto (y el window.__debug.ultimoDisparo general)
  // se fijan de forma síncrona al pulsar "Disparar", antes de que la
  // animación arranque -- por eso leer aquí no compite con el disparo
  // automático de la máquina, que solo llega después de que la animación
  // del jugador termine.
  await page.waitForFunction(() => window.__debug.control!.ultimoDisparo !== null);
  const ajuste = await page.evaluate(() => window.__debug.control!.ultimoDisparo);
  const impacto = await page.evaluate(() => window.__debug.ultimoDisparo!.impacto);
  return { ...ajuste!, impacto };
}

test("el mismo arrastre relativo produce el mismo ángulo, potencia e impacto en móvil y en escritorio", async ({
  page,
}) => {
  const enMovil = await arrastrarYDispararYLeer(page, { width: 360, height: 740 });
  const enEscritorio = await arrastrarYDispararYLeer(page, { width: 1280, height: 800 });

  expect(enMovil).toBeDefined();
  expect(enEscritorio).toBeDefined();

  expect(Math.abs(enMovil.anguloGrados - enEscritorio.anguloGrados)).toBeLessThanOrEqual(0.2);
  expect(Math.abs(enMovil.potencia - enEscritorio.potencia)).toBeLessThanOrEqual(1);
  expect(enMovil.armaId).toEqual(enEscritorio.armaId);
  expect(Math.abs(enMovil.impacto.x - enEscritorio.impacto.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(enMovil.impacto.y - enEscritorio.impacto.y)).toBeLessThanOrEqual(2);
});
