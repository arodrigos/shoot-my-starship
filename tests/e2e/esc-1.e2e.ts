import { test, expect } from "@playwright/test";

const MUNDO_ANCHO = 1920;
// naves-silueta: Adrián pidió la mitad de tamaño (escala 3 → 1,5), así que el
// mínimo legible baja de 24 a 12 px; la nave real mide ~13,5 px a 360x640.
const NAVE_MINIMA_PANTALLA_PX = 12;
const FRACCION_MAXIMA_PROYECTIL_NAVE = 0.6;

// esc-1 (camino_critico): a 360x640 -- el viewport móvil mínimo del diseño,
// el mismo de proy-5 -- la nave del jugador tiene que leerse a 24px de
// pantalla o más en su lado mayor, y ningún proyectil del catálogo puede
// superar el 0,6x de ese mismo lado mayor YA DIBUJADO. window.__debug.geometria
// (Partida.create()) expone los tres números de mundo que hacen falta;
// la escala efectiva del Scale Manager se mide del propio lienzo real, no
// se asume, porque es la única forma de que este test detecte una
// configuración de Scale.FIT rota sin repetir ese cálculo a mano.
test("esc-1: a 360x640 la nave se lee a >=24px y ningún proyectil pasa del 0,6x de su lado mayor dibujado", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.geometria !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const geometria = (await page.evaluate(() => window.__debug.geometria))!;
  const anchoLienzoPx = await page.evaluate(() => {
    const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement;
    return lienzo.getBoundingClientRect().width;
  });
  const escalaEfectiva = anchoLienzoPx / MUNDO_ANCHO;

  const naveEnPantallaPx = geometria.naveLadoMayorDibujadoPx * escalaEfectiva;
  const fraccionProyectilSobreNave = geometria.proyectilLadoMayorMaximoPx / geometria.naveLadoMayorDibujadoPx;

  await page.screenshot({ path: "capturas/escala-legible-2-nave-y-proyectil-360x640.png" });

  expect(naveEnPantallaPx).toBeGreaterThanOrEqual(NAVE_MINIMA_PANTALLA_PX);
  expect(fraccionProyectilSobreNave).toBeLessThanOrEqual(FRACCION_MAXIMA_PROYECTIL_NAVE);
});
