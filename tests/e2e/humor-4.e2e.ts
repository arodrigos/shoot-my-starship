import { test, expect } from "@playwright/test";

// humor-4: desbloquearAudio() solo se llama desde un gesto real del usuario
// -- nunca en un efecto de montaje -- así que antes de cualquier toque el
// AudioContext no debe existir, y el gesto que de verdad lo activa debe
// dejarlo en marcha sin que el navegador registre un aviso de autoplay
// bloqueado.
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
//
// DESVIACIÓN (sonido-procedimental, snd-1): el sonido arranca silenciado por
// defecto, así que ni el clic en "Jugar" ni el pointerdown de seguridad
// crean ya un AudioContext por sí solos (desbloquearAudio hace `if
// (silenciado) return`) -- el gesto que de verdad activa el audio es el
// interruptor toggle-silenciado del HUD, el mismo que snd-1 ya prueba. El
// clic en "Jugar" sigue siendo el primer gesto de la sesión y se comprueba
// que por sí solo NO deja el audio en marcha, antes de accionar el
// interruptor.
test("humor-4: el audio no arranca hasta el primer gesto real, y entonces arranca sin aviso de autoplay", async ({
  page,
}) => {
  const avisosAutoplay: string[] = [];
  page.on("console", (mensaje) => {
    if (/autoplay|NotAllowedError/i.test(mensaje.text())) {
      avisosAutoplay.push(mensaje.text());
    }
  });

  // banda-sonora: la música viene activada y SÍ crea el contexto con el clic
  // en "Jugar"; este test comprueba el camino de los efectos, así que se
  // parte con la música desactivada.
  await page.addInitScript(() => localStorage.setItem("banda-sonora:activada", "0"));
  await page.goto("/");
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  expect(await page.evaluate(() => window.__debug)).toBeUndefined();

  // El clic en "Jugar" es el primer gesto real de la sesión, pero con el
  // sonido silenciado por defecto (snd-1) no basta para desbloquear el audio.
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.estadoAudio !== undefined);
  expect(await page.evaluate(() => window.__debug.estadoAudio!())).toBe("sin-inicializar");

  // La ayuda inicial tapa el interruptor (solo aparece la primera vez por
  // origen): hay que cerrarla antes de poder pulsarlo, mismo patrón que
  // sonido-procedimental.e2e.ts y esc-1.e2e.ts.
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // El gesto que de verdad activa el audio es el interruptor del HUD.
  await page.getByTestId("toggle-silenciado").click();
  await page.waitForFunction(() => window.__debug.estadoAudio!() === "en-marcha");
  expect(avisosAutoplay).toEqual([]);
});
