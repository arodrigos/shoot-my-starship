import { test, expect } from "@playwright/test";

// encuadre-movil-4: una partida de 1 contra IA, de punta a punta, con el
// encuadre nuevo activo a 360x640 -- forzarFinDePartida() (ya usado por
// render-7) es lo que acota el número de turnos hasta que hay ganador: el
// enfrentamiento real contra la IA no converge en un número razonable de
// turnos en todos los mapas.
test("partida de punta a punta a 360x640 con el encuadre nuevo, hasta pantalla de ganador", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();

  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // encuadre-movil-1: el mundo que quedó activo no es el 1920x1080 fijo de
  // antes -- confirma que configurarTamanoMundo se aplicó de verdad en esta
  // misma partida, no solo en el test unitario aislado.
  const mundo = await page.evaluate(() => window.__debug.mundo!);
  expect(mundo.ancho).not.toBe(1920);
  expect(mundo.alto).not.toBe(1080);

  await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-01-inicio-360x640.png" });

  const viewport = page.viewportSize()!;
  const inicio = { x: viewport.width * 0.3, y: viewport.height * 0.85 };
  const fin = { x: viewport.width * 0.6, y: viewport.height * 0.55 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fin.x, fin.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-02-apuntado-360x640.png" });

  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.animacionEnCurso === true);
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-03-vuelo-360x640.png" });

  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 15000 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-04-impacto-360x640.png" });

  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0));
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
  await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-05-ganador-360x640.png" });
});
