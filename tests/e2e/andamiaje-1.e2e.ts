import { test, expect, type Page } from "@playwright/test";

// andamiaje-1: el mismo gesto relativo (misma fracción del viewport) debe
// producir la misma coordenada FRACCIONAL de mundo en cualquier tamaño de
// pantalla. La prueba no compara contra una constante fija -- compara los
// dos resultados entre sí, que es exactamente lo que el criterio exige.
//
// DESVIACIÓN (encuadre-movil): antes se comparaba la coordenada de mundo en
// PÍXELES ABSOLUTOS, válido mientras MUNDO_ANCHO/MUNDO_ALTO eran fijos
// (1920x1080) en cualquier dispositivo. encuadre-movil hace el mundo
// reconfigurable por el aspecto real del contenedor -- es justo lo que
// necesita encuadre-movil-1 para eliminar el letterbox -- así que móvil y
// escritorio ya tienen mundos de tamaño distinto a propósito. Comparar
// píxeles absolutos de mundos distintos no tiene sentido; la invariante que
// sigue viva es que el mismo punto RELATIVO del viewport cae en el mismo
// punto RELATIVO del mundo (normalizado por window.__debug.mundo) en los dos
// dispositivos.
async function tocarYLeerCoordenadaDeMundo(
  page: Page,
  viewport: { width: number; height: number },
  fraccion: { x: number; y: number },
) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.mundo !== undefined);

  await page.mouse.click(viewport.width * fraccion.x, viewport.height * fraccion.y);

  return page.evaluate(() => {
    const punto = window.__debug.ultimoPunto;
    const mundo = window.__debug.mundo!;
    if (punto === undefined) return undefined;
    return { x: punto.x / mundo.ancho, y: punto.y / mundo.alto };
  });
}

test("el mismo gesto relativo produce la misma coordenada de mundo en móvil y en escritorio", async ({
  page,
}) => {
  const fraccion = { x: 0.3, y: 0.6 };

  const enMovil = await tocarYLeerCoordenadaDeMundo(page, { width: 360, height: 740 }, fraccion);
  const enEscritorio = await tocarYLeerCoordenadaDeMundo(
    page,
    { width: 1280, height: 800 },
    fraccion,
  );

  expect(enMovil).toBeDefined();
  expect(enEscritorio).toBeDefined();

  // Fracción del mundo, no píxeles: con mundos de tamaño distinto por
  // dispositivo (encuadre-movil), un 1% del lado correspondiente es un
  // margen equivalente al 1px absoluto que se exigía cuando el mundo era
  // fijo.
  const TOLERANCIA_MUNDO_FRACCION = 0.01;
  expect(Math.abs(enMovil!.x - enEscritorio!.x)).toBeLessThanOrEqual(TOLERANCIA_MUNDO_FRACCION);
  expect(Math.abs(enMovil!.y - enEscritorio!.y)).toBeLessThanOrEqual(TOLERANCIA_MUNDO_FRACCION);
});
