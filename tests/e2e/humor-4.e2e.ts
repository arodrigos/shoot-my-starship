import { test, expect } from "@playwright/test";

// humor-4: desbloquearAudio() solo se llama desde el "pointerdown" real de la
// escena (ver Partida.ts) -- nunca en un efecto de montaje -- así que antes
// de cualquier toque el AudioContext no debe existir, y el primer toque real
// (el mismo que empieza a apuntar) debe dejarlo en marcha sin que el
// navegador registre un aviso de autoplay bloqueado.
test("humor-4: el audio no arranca hasta el primer gesto real, y entonces arranca sin aviso de autoplay", async ({
  page,
}) => {
  const avisosAutoplay: string[] = [];
  page.on("console", (mensaje) => {
    if (/autoplay|NotAllowedError/i.test(mensaje.text())) {
      avisosAutoplay.push(mensaje.text());
    }
  });

  await page.goto("/");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);

  expect(await page.evaluate(() => window.__debug.estadoAudio!())).toBe("sin-inicializar");

  // El propio botón "Entendido" de la ayuda inicial (si aparece) o cualquier
  // toque en la superficie de arrastre son gestos reales igual de válidos:
  // el criterio es "un gesto real", no un botón dedicado (ver desviaciones).
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  } else {
    await page.getByTestId("superficie-arrastre").click({ position: { x: 50, y: 50 } });
  }

  await page.waitForFunction(() => window.__debug.estadoAudio!() === "en-marcha");
  expect(avisosAutoplay).toEqual([]);
});
