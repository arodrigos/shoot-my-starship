import { test, expect } from "@playwright/test";

// humor-4: desbloquearAudio() solo se llama desde un gesto real del usuario
// -- nunca en un efecto de montaje -- así que antes de cualquier toque el
// AudioContext no debe existir, y el primer toque real debe dejarlo en
// marcha sin que el navegador registre un aviso de autoplay bloqueado.
//
// DESVIACIÓN (partida-completa): el primer gesto real de la sesión ya no es
// el pointerdown dentro del lienzo -- es el propio botón "Jugar" de la
// pantalla de inicio (PantallaInicio.tsx llama a desbloquearAudio() ahí),
// que ahora existe antes de que Phaser llegue a montarse. El lienzo (y por
// tanto window.__debug) no existe todavía en la pantalla de inicio, así que
// "antes de cualquier toque" se comprueba con window.__debug === undefined
// en vez de con estadoAudio() === "sin-inicializar": estructuralmente,
// mientras JuegoLienzo no se monta, el único punto del código que puede
// crear un AudioContext (desbloquearAudio, en motor.ts) no se ha llamado
// todavía. El pointerdown de Partida.ts sigue existiendo como red de
// seguridad para gestos posteriores, pero ya no es el primero.
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
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  expect(await page.evaluate(() => window.__debug)).toBeUndefined();

  // El clic en "Jugar" es el primer gesto real de la sesión: el mismo que
  // desbloquea el audio (ver desviación arriba).
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.estadoAudio !== undefined);

  await page.waitForFunction(() => window.__debug.estadoAudio!() === "en-marcha");
  expect(avisosAutoplay).toEqual([]);
});
