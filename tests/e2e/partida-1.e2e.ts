import { test, expect } from "@playwright/test";

// partida-1 (camino_critico): el recorrido completo tal como lo hace Adrián
// con el dedo -- pantalla de inicio, elegir rival, jugar con un gesto real
// contra la IA de verdad hasta que hay ganador, ver el parte de guerra y que
// "otra partida" arranque un mundo distinto. Viewport 360x740 (el móvil de
// referencia del diseño).
//
// Jugar la partida entera turno a turno con arrastres reales (como control-1)
// tomaría entre 12 y 56 turnos según personalidad (partida-3), demasiado para
// un e2e sin volverse lento o dependiente de la IA de verdad turno a turno.
// Este test SÍ hace un disparo real con gesto de arrastre (para probar que el
// camino de entrada real funciona de punta a punta, igual que control-1), y
// después usa window.__debug.forzarFinDePartida() -- el mismo mecanismo ya
// sancionado por render-7/humor-7 -- para llegar a un ganador de forma
// determinista sin esperar a que la IA converja. Declarado en desviaciones.
test("recorrido completo: inicio, elegir rival, jugar y ganar, y otra partida cambia de mundo", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 360, height: 740 });

  await page.goto("/");
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  await expect(page.getByTestId("descripcion-juego")).not.toBeEmpty();

  await page.getByTestId("rival-almirante-bisagra").click();
  await expect(page.getByTestId("rival-almirante-bisagra")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.mapa !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const mapaPrimeraPartida = (await page.evaluate(() => window.__debug.mapa))!;

  // Disparo real con gesto de arrastre (dirección arbitraria: este disparo
  // solo demuestra que el camino de entrada real funciona, no necesita
  // acertar) para probar que "jugar con gestos reales" es de verdad cierto
  // en este recorrido, no solo en control-1 por separado.
  const inicio = { x: 180, y: 620 };
  const fin = { x: 220, y: 520 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    () => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2 && window.__debug.animacionEnCurso === false,
    undefined,
    { timeout: 60000 },
  );

  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0), undefined, {
    timeout: 60000,
  });

  const naves = (await page.evaluate(() => window.__debug.naves))!;
  const ganador = naves.find((nave) => nave.integridad > 0);
  const perdedor = naves.find((nave) => nave.integridad <= 0);
  expect(ganador).toBeDefined();
  expect(perdedor).toBeDefined();
  expect(perdedor!.integridad).toBe(0);

  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
  await expect(page.getByTestId("parte-de-guerra-medalla")).not.toBeEmpty();
  await expect(page.getByTestId("parte-de-guerra-texto")).not.toBeEmpty();
  const parte = await page.evaluate(() => window.__debug.parteDeGuerra);
  expect(parte).not.toBeNull();
  expect(parte!.estadisticas.disparos).toBeGreaterThan(0);

  await page.getByTestId("otra-partida").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.mapa !== undefined && window.__debug.numeroTurno === 0);

  const mapaSegundaPartida = (await page.evaluate(() => window.__debug.mapa))!;
  expect(mapaSegundaPartida.id).not.toBe(mapaPrimeraPartida.id);
  expect(mapaSegundaPartida.semillaTerreno).not.toBe(mapaPrimeraPartida.semillaTerreno);
});
