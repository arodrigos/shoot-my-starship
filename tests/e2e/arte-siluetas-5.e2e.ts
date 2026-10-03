import { test, expect } from "@playwright/test";

// arte-siluetas-5 (camino_critico): recorrido completo a 360x640 (el
// viewport móvil de referencia) con capturas en apuntado, vuelo e impacto
// -- misma receta que partida-1 (gesto real de arrastre + forzarFinDePartida
// para llegar a un ganador sin esperar a que la IA converja turno a turno,
// declarado en desviaciones igual que allí). Lo que este test añade sobre
// partida-1 es la EVIDENCIA VISUAL exigida por el criterio: tres capturas
// que un humano puede mirar y comprobar que las naves/proyectiles se leen
// distintos, no solo que el marcador de integridad bajó.
test("recorrido completo a 360x640 con capturas en apuntado, vuelo e impacto", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });

  await page.goto("/");
  await page.getByTestId("rival-almirante-bisagra").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.mapa !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // Apuntado: las dos naves y el HUD visibles antes de cualquier disparo --
  // arte-siluetas-3 (silueta + indicador de nave propia) se lee aquí.
  await page.screenshot({ path: "capturas/arte-siluetas-5-1-apuntado-360x640.png" });

  const inicio = { x: 180, y: 520 };
  const fin = { x: 220, y: 420 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  // Vuelo: el proyectil ya en el aire, orientado a su velocidad
  // (arte-siluetas-2) -- se captura en cuanto hay animación en curso, antes
  // de que se resuelva el turno.
  await page.waitForFunction(() => window.__debug.animacionEnCurso === true, undefined, { timeout: 30000 });
  await page.screenshot({ path: "capturas/arte-siluetas-5-2-vuelo-360x640.png" });

  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 120000 });

  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0), undefined, {
    timeout: 60000,
  });

  // Impacto/resultado: el parte de guerra con un ganador y un perdedor.
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
  await page.screenshot({ path: "capturas/arte-siluetas-5-3-impacto-360x640.png" });

  const naves = (await page.evaluate(() => window.__debug.naves))!;
  expect(naves.some((nave) => nave.integridad > 0)).toBe(true);
  expect(naves.some((nave) => nave.integridad <= 0)).toBe(true);
});
