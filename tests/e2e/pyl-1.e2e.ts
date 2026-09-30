import { test } from "@playwright/test";

// deviceScaleFactor 3: el viewport CSS sigue siendo 360x640 (el mismo que
// pyl-3 dispara), pero la captura se guarda a densidad de píxel real de
// teléfono en vez de a 1x -- el recorte de abajo mide en CSS px (igual que
// getBoundingClientRect), así que el área capturada no cambia, solo su
// resolución, para que el gatekeeper pueda juzgar la forma sin ampliar un
// PNG de 131x56.
test.use({ deviceScaleFactor: 3 });

const MUNDO_ANCHO = 1920;
// Mismas constantes que src/juego/scenes/Siluetas.ts: la rejilla de las 13
// armas ocupa este rectángulo fijo en coordenadas de mundo, esquina
// superior izquierda.
const ANCHO_CELDA = 140;
const ALTO_CELDA = 100;
const COLUMNAS = 5;
const FILAS = 3;

// pyl-1: misma escena de depuración y el mismo fillPoints que usa
// AnimadorProyectil en vuelo real (ver proy-1-captura.e2e.ts), pero a la
// escala mínima que el criterio exige explícitamente (360x640) en vez de a
// los 700x400 de proy-1. La rejilla ocupa un rectángulo fijo de MUNDO (no de
// pantalla) así que a 360px de ancho el recorte sin más saldría diminuto en
// un lienzo mayormente vacío -- se recorta la captura al propio rectángulo
// de la rejilla (mismo cálculo mundo->pantalla que proy-5/pyl-3) para que el
// juicio visual del gatekeeper sea sobre las formas, no sobre encontrarlas
// en una esquina.
test("captura: las trece siluetas del catálogo (ocho familias) a 360x640", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/pruebas/siluetas");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.siluetasListo === true);

  const rectanguloLienzo = await page.evaluate(() => {
    const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement;
    const r = lienzo.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  const escala = rectanguloLienzo.width / MUNDO_ANCHO;
  const clip = {
    x: rectanguloLienzo.left,
    y: rectanguloLienzo.top,
    width: ANCHO_CELDA * COLUMNAS * escala,
    height: ALTO_CELDA * FILAS * escala,
  };
  await page.screenshot({ path: "capturas/proyectiles-siluetas-9-pyl1-siluetas-360x640.png", clip });
});
