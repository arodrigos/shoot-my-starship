import { test, expect } from "@playwright/test";
import { TIPOS_EVENTO_HUMOR } from "@/sim/partida/eventos";

// humor-2: ningún golpe cómico depende de que el audio funcione -- con
// Chromium arrancado en modo silencio (--mute-audio, la forma real de que un
// navegador deje mudo un AudioContext sin que la página se entere por ningún
// error) la reacción visual y textual deben seguir apareciendo exactamente
// igual, y ninguna llamada a reproducirTono debe lanzar un error sin capturar
// que rompa la partida.
test.use({ launchOptions: { args: ["--mute-audio"] } });

test("humor-2: con el navegador silenciado, la reacción visual y textual aparece igualmente y nada lanza sin capturar", async ({
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

  // El criterio pide recorrer los 7 tipos de golpe cómico, no solo el que
  // forzarFinDePartida garantiza (autoimpacto): dispararReaccionHumor pasa
  // por el mismo reaccionarAHumor que usa una partida real, uno por uno, y
  // se comprueba que cada uno deja lectura visual/textual con el audio mudo.
  const banner = page.getByTestId("reaccion-texto");
  for (const tipo of TIPOS_EVENTO_HUMOR) {
    await page.evaluate((t) => window.__debug.dispararReaccionHumor!(t), tipo);
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("data-tipo-evento", tipo);
    expect((await banner.textContent())?.length ?? 0).toBeGreaterThan(0);
  }

  // Además, en una partida real (no sintética) sigue apareciendo la reacción
  // igual que sin silenciar: forzarFinDePartida garantiza al menos un
  // autoimpacto real de la simulación.
  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0));

  const eventos = await page.evaluate(() => window.__debug.ultimosEventos ?? []);
  expect(eventos.some((evento) => evento.tipo === "autoimpacto")).toBe(true);
  await expect(banner).toBeVisible();

  expect(erroresDePagina).toEqual([]);
});
