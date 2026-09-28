import { test, expect } from "@playwright/test";

// hum-6: mismo patrón real que humor-2 (humor-sistemico) -- Chromium
// arrancado con --mute-audio es la forma real de que un navegador deje mudo
// un AudioContext sin que la página se entere por ningún error (ver
// motor.ts: ninguna función de audio lanza nunca). Las bromas no pasan por
// audio en ningún punto de su publicación (broma.ts/BromaHUD.tsx), así que
// deben aparecer exactamente igual con el sonido bloqueado.
test.use({ launchOptions: { args: ["--mute-audio"] } });

test("hum-6: con el navegador silenciado (autoplay/audio bloqueado), las bromas de disparo e impacto aparecen igual", async ({
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

  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => (window.__debug.numeroTurno ?? 0) > 0);

  const disparoTexto = page.getByTestId("broma-disparo-texto");
  const impactoTexto = page.getByTestId("broma-impacto-texto");
  await expect(disparoTexto).toBeVisible();
  await expect(impactoTexto).toBeVisible();
  expect((await disparoTexto.textContent())?.length ?? 0).toBeGreaterThan(0);
  expect((await impactoTexto.textContent())?.length ?? 0).toBeGreaterThan(0);

  expect(erroresDePagina).toEqual([]);
});
