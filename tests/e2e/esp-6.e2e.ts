import { test, expect } from "@playwright/test";

// esp-6 (usabilidad): antes de disparar hay un texto de ayuda que explica el
// apuntado Y, en el hito espacial, la gravedad de los planetas y la
// posibilidad de perder el disparo en órbita; el panel de resultado del
// turno tiene su propio estado vacío no en blanco (nunca un hueco mudo antes
// del primer disparo); y "proyectil perdido en órbita" tiene su propio
// mensaje explicativo, distinto del genérico de impacto/fallo.
test("la ayuda explica el modo espacial, el panel de resultado nunca está en blanco, y perder el disparo tiene su propio mensaje", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);

  // La ayuda inicial (primera visita del navegador: sin localStorage previo)
  // debe estar visible y explicar tanto el apuntado general como, en modo
  // espacial, la gravedad de los planetas y la pérdida en órbita.
  const ayudaInicial = page.getByTestId("ayuda-inicial");
  await expect(ayudaInicial).toBeVisible();
  const textoAyudaGeneral = await page.getByTestId("ayuda-inicial").innerText();
  expect(textoAyudaGeneral.length).toBeGreaterThan(20);

  const ayudaEspacial = page.getByTestId("ayuda-espacial");
  await expect(ayudaEspacial).toBeVisible();
  const textoAyudaEspacial = await ayudaEspacial.innerText();
  expect(textoAyudaEspacial.toLowerCase()).toContain("planeta");
  expect(textoAyudaEspacial.toLowerCase()).toContain("órbita");

  await page.getByTestId("ayuda-cerrar").click();
  await expect(ayudaInicial).not.toBeVisible();

  // Antes de disparar, el panel de resultado del turno ya tiene su propio
  // texto no vacío -- nunca un hueco mudo esperando al primer disparo.
  const panelResultado = page.getByTestId("resultado-turno");
  await expect(panelResultado).toBeVisible();
  const textoInicialPanel = await panelResultado.innerText();
  expect(textoInicialPanel.trim().length).toBeGreaterThan(0);

  // grav-6/render-espacio: forzar un cierre de turno con un evento real de
  // "proyectil-perdido" (el mismo aplicarResultadoTurno que usa un disparo
  // de verdad) -- encontrar por gesto una órbita estable de un sistema
  // concreto no es necesario para comprobar el TEXTO del resultado, que es
  // lo que pide este criterio.
  await page.evaluate(() => window.__debug.forzarProyectilPerdido!());
  await page.waitForFunction(
    (textoAnterior) => window.__debug.resultadoTurno !== undefined && window.__debug.resultadoTurno !== textoAnterior,
    textoInicialPanel,
  );

  const textoTrasPerdido = await panelResultado.innerText();
  expect(textoTrasPerdido.trim().length).toBeGreaterThan(0);
  expect(textoTrasPerdido).not.toBe(textoInicialPanel);
  expect(textoTrasPerdido.toLowerCase()).toContain("órbita");
  // El mensaje de "perdido" tiene que ser distinto del genérico de fallo de
  // arma -- si compartieran texto, "proyectil-perdido" no tendría en
  // realidad su propio mensaje explicativo.
  expect(textoTrasPerdido.toLowerCase()).not.toContain("el arma ha fallado");
});
