import { test, expect } from "@playwright/test";

// hum-6: mismo patrón real que humor-2 (humor-sistemico) -- Chromium
// arrancado con --mute-audio es la forma real de que un navegador deje mudo
// un AudioContext sin que la página se entere por ningún error (ver
// motor.ts: ninguna función de audio lanza nunca). Las bromas no pasan por
// audio en ningún punto de su publicación (broma.ts/BromaHUD.tsx), así que
// deben aparecer exactamente igual con el sonido bloqueado.
test.use({ launchOptions: { args: ["--mute-audio"] } });

test("hum-6: con el navegador silenciado (autoplay/audio bloqueado), el resumen de la partida aparece igual", async ({
  page,
}) => {
  test.setTimeout(60000);
  const erroresDePagina: string[] = [];
  page.on("pageerror", (error) => erroresDePagina.push(error.message));

  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // Tres turnos resueltos: al tercero toca resumen.
  await page.evaluate(() => window.__debug.jugarTurnosGuionizados!(3));
  await page.waitForFunction(() => (window.__debug.historialBromas?.length ?? 0) >= 3);

  const resumenTexto = page.getByTestId("resumen-texto");
  await expect(resumenTexto).toBeVisible();
  expect((await resumenTexto.textContent())?.length ?? 0).toBeGreaterThan(0);

  expect(erroresDePagina).toEqual([]);
});
