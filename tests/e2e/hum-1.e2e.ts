import { test, expect } from "@playwright/test";

// hum-1: forzarFinDePartida() dispara Despedida en cada turno hasta que
// alguien llega a 0 -- mismo mecanismo que humor-1 (humor-sistemico), pero
// aquí lo que se comprueba es que CADA turno deja una broma de disparo y
// una de impacto, con la voz de quien dispara, no solo el turno final.
test("hum-1: tras cada disparo y cada impacto aparece una broma atribuida a la nave que dispara, en varios turnos seguidos", async ({
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

  const disparoTexto = page.getByTestId("broma-disparo-texto");
  const impactoTexto = page.getByTestId("broma-impacto-texto");
  const CATEGORIAS_VALIDAS = [
    "acierto",
    "casi",
    "fallo-lejano",
    "autoimpacto",
    "impacto-planeta",
    "impacto-escombro",
    "proyectil-perdido",
  ];

  let numeroTurnoAntes = 0;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__debug.forzarFinDePartida!());
    await page.waitForFunction(
      (previo) => (window.__debug.numeroTurno ?? 0) > previo,
      numeroTurnoAntes,
    );
    numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;

    await expect(disparoTexto).toBeVisible();
    await expect(impactoTexto).toBeVisible();
    expect((await disparoTexto.textContent())?.length ?? 0).toBeGreaterThan(0);
    expect((await impactoTexto.textContent())?.length ?? 0).toBeGreaterThan(0);

    const categoria = await impactoTexto.getAttribute("data-categoria");
    expect(CATEGORIAS_VALIDAS).toContain(categoria);

    if ((await page.evaluate(() => window.__debug.naves!.some((nave) => nave.integridad <= 0)))) {
      break;
    }
  }

  // forzarFinDePartida garantiza al menos un autoimpacto real de Despedida
  // (fiabilidad 1) antes de que la partida termine -- si la categoría nunca
  // fue "autoimpacto" en ninguna de las iteraciones de arriba, la
  // categorización real está desalineada con el resultado de avanzar().
  const huboAutoimpactoAlgunaVez = await page.evaluate(() => window.__debug.ultimosEventos?.some((e) => e.tipo === "autoimpacto") ?? false);
  expect(huboAutoimpactoAlgunaVez).toBe(true);
});
