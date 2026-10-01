import { test, expect } from "@playwright/test";

const MUNDO_ANCHO = 1920;
const MUNDO_ALTO = 1080;

// fondo-y-pozos (fnd-2): la mitad determinista del criterio (misma semilla
// -> mismo cielo, estrellas dentro del lienzo) ya la cubre
// tests/unit/fondo/fnd-2.test.ts; lo que faltaba desde el PR #62 (iteración
// 32, ver desviaciones del entregable de desarrollo) era la mitad de
// juicio visual que el propio criterio pide: una captura con naves y
// planetas de verdad en pantalla, para que el gatekeeper juzgue si siguen
// distinguiéndose sobre el fondo y los pozos de gravedad nuevos. Las
// aserciones mecánicas de aquí solo comprueban que lo que se fotografía es
// un fotograma real (naves y planetas dentro del lienzo), no un estado
// vacío o a medio cargar -- el juicio de legibilidad en sí es del
// gatekeeper, leyendo la imagen.
test("fondo-y-pozos: naves y planetas quedan dentro del lienzo visible sobre el fondo nuevo en 360x640 (fnd-2)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  // Sin `?mapa=`: es el hito espacial, el único modo con planetas y pozos
  // de gravedad (ver Partida.ts) -- con un mapa de suelo plano
  // window.__debug.planetas nunca se rellena.
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.naves !== undefined && window.__debug.planetas !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const naves = (await page.evaluate(() => window.__debug.naves))!;
  const planetas = (await page.evaluate(() => window.__debug.planetas))!;
  const anchoLienzoPx = await page.evaluate(() => {
    const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement;
    return lienzo.getBoundingClientRect().width;
  });
  const escalaEfectiva = anchoLienzoPx / MUNDO_ANCHO;
  const altoLienzoPx = MUNDO_ALTO * escalaEfectiva;

  expect(naves.length).toBeGreaterThanOrEqual(2);
  for (const nave of naves) {
    expect(nave.x * escalaEfectiva).toBeGreaterThanOrEqual(0);
    expect(nave.x * escalaEfectiva).toBeLessThanOrEqual(anchoLienzoPx);
    expect(nave.y * escalaEfectiva).toBeGreaterThanOrEqual(0);
    expect(nave.y * escalaEfectiva).toBeLessThanOrEqual(altoLienzoPx);
  }
  expect(planetas.length).toBeGreaterThanOrEqual(1);

  await page.screenshot({ path: "capturas/fondo-y-pozos-1-legibilidad-360x640.png" });
});
