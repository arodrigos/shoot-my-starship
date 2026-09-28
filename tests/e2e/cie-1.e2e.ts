import { test, expect } from "@playwright/test";

// cie-1 (camino_critico): de punta a punta sobre el despliegue (ver
// desviaciones del entregable -- se ejecuta contra el mismo servidor de
// producción local, npm run start, que usa el resto de la suite de e2e, no
// contra una URL de Vercel: el proyecto de Vercel de este producto se crea en
// la etapa de traspaso, DESPUÉS de que Gatekeeper apruebe este mismo bloque
// -- ver el comentario de .github/workflows/ci.yml, job "e2e"). Dos partidas
// SEGUIDAS, cada una con un sistema y un rival distintos, jugadas de verdad
// (arrastre + disparo real, después forzarFinDePartida -- mismo mecanismo ya
// sancionado por partida-1/render-7/humor-7 para llegar a un ganador sin
// esperar a que la IA converja turno a turno) hasta que hay un ganador
// declarado, sin ningún error de consola en ninguna de las dos.
test("dos partidas seguidas, cada una con su propio mundo y rival, jugadas hasta que hay ganador, sin errores de consola", async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 360, height: 740 });

  const erroresDeConsola: string[] = [];
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") erroresDeConsola.push(mensaje.text());
  });
  page.on("pageerror", (error) => erroresDeConsola.push(String(error)));

  async function jugarUnaPartidaHastaGanar(rivalId: string, mapaId: string) {
    await expect(page.getByTestId(`rival-${rivalId}`)).toBeVisible();
    await page.getByTestId(`rival-${rivalId}`).click();
    await expect(page.getByTestId(`rival-${rivalId}`)).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.mapa !== undefined);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) {
      await page.getByTestId("ayuda-cerrar").click();
    }

    const mapa = (await page.evaluate(() => window.__debug.mapa))!;
    expect(mapa.id).toBe(mapaId);

    // Disparo real con gesto de arrastre: cada partida usa una dirección
    // distinta a propósito (no necesita acertar, solo demostrar que el
    // camino de entrada real funciona en las dos, no solo en la primera).
    const inicio = { x: 180, y: 620 };
    const fin = { x: 220, y: 520 };
    await page.mouse.move(inicio.x, inicio.y);
    await page.mouse.down();
    await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
    await page.mouse.move(fin.x, fin.y, { steps: 5 });
    await page.mouse.up();

    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await page.getByTestId("disparar").click();
    // El turno vuelve al jugador (respuesta real de la IA rival ya resuelta)
    // antes de forzar el final, para que quede constancia de que la partida
    // tuvo disparo del jugador Y respuesta del rival, no solo lo primero.
    await page.waitForFunction(
      () => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2 && window.__debug.animacionEnCurso === false,
      undefined,
      { timeout: 120000 },
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
    const parte = await page.evaluate(() => window.__debug.parteDeGuerra);
    expect(parte).not.toBeNull();
    expect(parte!.estadisticas.disparos).toBeGreaterThan(0);
  }

  await page.goto("/?mapa=desguace-del-ecuador");
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  await jugarUnaPartidaHastaGanar("almirante-bisagra", "desguace-del-ecuador");

  await page.getByTestId("otra-partida").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.numeroTurno === 0);

  // La segunda partida sigue en la misma pestaña (no hay recarga real), así
  // que para tener un sistema DISTINTO de verdad hay que volver a la
  // pantalla de inicio y arrancar de nuevo con otro ?mapa, no confiar en el
  // sorteo del botón "otra partida" (que puede repetir mundo por azar).
  await page.goto("/?mapa=corriente-de-estribor");
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  await jugarUnaPartidaHastaGanar("la-contable", "corriente-de-estribor");

  expect(erroresDeConsola).toEqual([]);
});
