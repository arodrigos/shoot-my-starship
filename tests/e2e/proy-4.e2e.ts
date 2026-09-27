import { test, expect } from "@playwright/test";

// proy-4 (no camino_critico -- se anota si falla, no bloquea el bloque):
// tras 20 disparos seguidos el pool de partículas de la estela no puede
// crecer sin límite ni superar su tope declarado, y debe volver a un valor
// de reposo (0 partículas vivas) entre turnos en vez de arrastrar sobrantes.
//
// 20 vuelos animados a velocidad real (ver imp-11/imp-12, ~70s cada uno bajo
// WebGL por software) tardarían más de 20 minutos, inviable en CI -- por eso
// el test usa dispararRafagaTurbo (desviación, ver entregable), que dispara
// los mismos turnos reales (mismo dispararEntrada, misma animación, misma
// emisión de estela) pero empujando ella misma el reloj de Scene.update()
// en vez de esperar frames reales del navegador.
test("proy-4: el pool de partículas de la estela nunca supera su tope y vuelve a reposo entre turnos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.estela !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // Reposo antes de disparar: la escena arranca sin ningún vuelo en curso.
  expect(await page.evaluate(() => window.__debug.estela!.vivas)).toBe(0);

  const tope = await page.evaluate(() => window.__debug.estela!.tope);
  expect(tope).toBeGreaterThan(0);

  // La ráfaga en sí es una única llamada síncrona (ver comentario de
  // dispararRafagaTurbo en Partida.ts): no hay forma de muestrear "vivas"
  // fotograma a fotograma desde el test mientras corre, así que la garantía
  // de "nunca supera el tope" se lee de estelaMaxVivas, el máximo acumulado
  // que la propia escena lleva por cada fotograma que procesa internamente.
  await page.evaluate(() => window.__debug.dispararRafagaTurbo!(20));

  const numeroTurnoTrasRafaga = await page.evaluate(() => window.__debug.numeroTurno);
  expect(numeroTurnoTrasRafaga).toBeGreaterThanOrEqual(20);

  const maxVivasTrasRafaga = await page.evaluate(() => window.__debug.estelaMaxVivas);
  expect(maxVivasTrasRafaga).toBeGreaterThan(0); // hubo vuelos de verdad, no un no-op
  expect(maxVivasTrasRafaga).toBeLessThanOrEqual(tope!);

  // Reposo tras la ráfaga: la ráfaga corrió síncrona (sin frames reales de
  // por medio), así que las partículas emitidas durante ella no habrán
  // envejecido todavía -- hace falta dejar pasar frames reales para que su
  // lifespan (220ms) se consuma y el contador vuelva a 0, sin crecimiento
  // acumulado de una ráfaga a la siguiente.
  await page.waitForFunction(() => window.__debug.estela!.vivas === 0, undefined, { timeout: 5000 });

  const maxVivasEnReposo = await page.evaluate(() => window.__debug.estelaMaxVivas);
  expect(maxVivasEnReposo).toBeLessThanOrEqual(tope!);
});
