import { test, expect } from "@playwright/test";

// humor-1: forzarFinDePartida() dispara Despedida (daño y autodaño
// garantizado, fiabilidad 1) en cada turno hasta que alguien llega a 0 -- así
// que SIEMPRE emite al menos un "autoimpacto" antes de terminar, el mismo
// mecanismo ya usado por render-7 para acotar el número de turnos. Es la
// única forma de forzar un evento de humor concreto sin depender de que la
// IA lo produzca por azar en un número razonable de turnos.
test("humor-1: un evento de humor dispara una reacción visible y mueve la cámara en el mismo turno", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await page.evaluate(() => window.__debug.forzarFinDePartida!());

  // La sacudida dura solo 220ms: si el polling arrancara después de las
  // comprobaciones del banner (varios viajes de ida y vuelta al navegador),
  // podría empezar a mirar cuando la sacudida ya ha terminado, dando un falso
  // negativo. Se lanza el polling ya mismo, en paralelo con el resto de
  // comprobaciones, para que la ventana de observación empiece lo antes
  // posible tras el turno que la dispara.
  const sacudidaDetectada = expect
    .poll(async () => page.evaluate(() => window.__debug.sacudiendoCamara === true), {
      timeout: 5000,
      intervals: [20, 50],
    })
    .toBe(true);

  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0));

  const eventos = await page.evaluate(() => window.__debug.ultimosEventos ?? []);
  expect(eventos.some((evento) => evento.tipo === "autoimpacto")).toBe(true);

  // El turno final puede traer más de un evento de humor (p.ej. un derrumbe
  // encadenado tras el autoimpacto): reaccionarAHumor procesa el turno en
  // orden y el banner se queda con el último, así que se comprueba que lo
  // mostrado es de verdad uno de los eventos de ESTE turno, no que sea
  // necesariamente el autoimpacto que garantizó que hubiera alguno.
  const banner = page.getByTestId("reaccion-texto");
  await expect(banner).toBeVisible();
  const tipoMostrado = await banner.getAttribute("data-tipo-evento");
  expect(eventos.some((evento) => evento.tipo === tipoMostrado)).toBe(true);
  expect((await banner.textContent())?.length ?? 0).toBeGreaterThan(0);

  // Comprobado por polling (lanzado más arriba, antes de las demás
  // comprobaciones), porque la sacudida es una animación de 220ms, no un
  // salto instantáneo, y shakeEffect transforma la matriz de render de la
  // cámara -- nunca su worldView/scroll -- así que no hay forma de detectarla
  // comparando el rectángulo de cámara entre dos instantes.
  await sacudidaDetectada;
});
