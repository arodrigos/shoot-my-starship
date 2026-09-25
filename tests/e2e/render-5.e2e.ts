import { test, expect } from "@playwright/test";

// render-5: tras perder y recuperar el contexto WebGL durante una partida de
// 3 turnos con explosiones, el terreno debe repintarse desde la máscara
// ACTUAL (con los cráteres ya abiertos), no desde la textura inicial -- es
// exactamente el bug que Terreno.repintarCompleta() evita al leer
// this.mascara (la referencia viva) en vez de una copia congelada.
test("tras perder y recuperar el contexto WebGL, el terreno repintado respeta los cráteres ya abiertos", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true);

  await page.evaluate(() => window.__debug.jugarTurnosGuionizados!(3));

  const restauracionesAntes = await page.evaluate(() => window.__debug.webgl?.restauraciones ?? 0);

  await page.evaluate(() => {
    const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement;
    const gl = (lienzo.getContext("webgl2") ?? lienzo.getContext("webgl")) as WebGLRenderingContext;
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension) {
      throw new Error("WEBGL_lose_context no disponible en este navegador");
    }
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 50);
  });

  await page.waitForFunction(
    (esperadas) => (window.__debug.webgl?.restauraciones ?? 0) > esperadas,
    restauracionesAntes,
    { timeout: 10000 },
  );

  const MUNDO_ANCHO = 1920;
  const MUNDO_ALTO = 1080;
  const NUM_PUNTOS = 2000;

  const resultados = await page.evaluate(
    ({ ancho, alto, numeroDePuntos }) => {
      let estado = 24681357;
      const siguiente = () => {
        estado = (estado * 1103515245 + 12345) & 0x7fffffff;
        return estado / 0x7fffffff;
      };
      const puntos = Array.from({ length: numeroDePuntos }, () => ({
        x: Math.floor(siguiente() * ancho),
        y: Math.floor(siguiente() * alto),
      }));
      return window.__debug.terreno!.comprobarPuntos(puntos);
    },
    { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, numeroDePuntos: NUM_PUNTOS },
  );

  expect(resultados).toHaveLength(NUM_PUNTOS);
  expect(resultados.every(Boolean)).toBe(true);
});
