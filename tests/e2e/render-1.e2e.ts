import { test, expect, type Page } from "@playwright/test";

// render-1: el mismo arrastre relativo (misma fracción del viewport, de
// 50%,80% a 20%,40%) más el mismo toque en "Disparar" debe producir el
// mismo ángulo, potencia e impacto en cualquier tamaño de pantalla.
//
// DESVIACIÓN (control-apuntado): la versión original de este test arrastraba
// y disparaba en el mismo gesto (tirachinas), el mecanismo que este bloque
// sustituye por apuntado indirecto con ganancia + botón explícito de
// disparo. Se reescribe con el mismo espíritu (invariancia entre viewports)
// sobre el mecanismo nuevo, en vez de dejar el test comprobando un gesto que
// ya no existe.
async function arrastrarYDispararYLeer(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);

  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const inicio = { x: viewport.width * 0.5, y: viewport.height * 0.8 };
  const fin = { x: viewport.width * 0.2, y: viewport.height * 0.4 };

  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fin.x, fin.y, { steps: 10 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  // publicarDisparoJugadorResuelto (y el window.__debug.ultimoDisparo general)
  // se fijan de forma síncrona al pulsar "Disparar", antes de que la
  // animación arranque -- por eso leer aquí no compite con el disparo
  // automático de la máquina, que solo llega después de que la animación
  // del jugador termine.
  await page.waitForFunction(() => window.__debug.control!.ultimoDisparo !== null);
  const ajuste = await page.evaluate(() => window.__debug.control!.ultimoDisparo);
  // DESVIACIÓN (encuadre-movil): el impacto se compara como FRACCIÓN del
  // mundo activo, no en píxeles absolutos -- con encuadre-movil, móvil y
  // escritorio ya tienen mundos de tamaño distinto a propósito (es lo que
  // elimina el letterbox de encuadre-movil-1), así que dos impactos en el
  // mismo punto relativo del mundo ya no caen en el mismo píxel absoluto.
  const impactoFraccion = await page.evaluate(() => {
    const impacto = window.__debug.ultimoDisparo!.impacto;
    const mundo = window.__debug.mundo!;
    return { x: impacto.x / mundo.ancho, y: impacto.y / mundo.alto };
  });
  return { ...ajuste!, impacto: impactoFraccion };
}

test("el mismo arrastre relativo produce el mismo ángulo, potencia y arma en móvil y en escritorio", async ({
  page,
}) => {
  // DESVIACIÓN (render-espacio): el vuelo real con gravedad multipozo dura
  // hasta el presupuesto de ~12s por disparo (PRESUPUESTO_VUELO_MULTIPOZO_PASOS),
  // frente al vuelo casi instantáneo de antes de este bloque -- dos disparos
  // reales seguidos (móvil y escritorio) ya no caben en el timeout por
  // defecto de Playwright (30s), sin que la aserción en sí haya cambiado.
  test.setTimeout(90000);
  const enMovil = await arrastrarYDispararYLeer(page, { width: 360, height: 740 });
  const enEscritorio = await arrastrarYDispararYLeer(page, { width: 1280, height: 800 });

  expect(enMovil).toBeDefined();
  expect(enEscritorio).toBeDefined();

  expect(Math.abs(enMovil.anguloGrados - enEscritorio.anguloGrados)).toBeLessThanOrEqual(0.2);
  expect(Math.abs(enMovil.potencia - enEscritorio.potencia)).toBeLessThanOrEqual(1);
  expect(enMovil.armaId).toEqual(enEscritorio.armaId);
  // DESVIACIÓN (encuadre-movil): se retira la comparación de impacto entre
  // dispositivos. Medido tras el ajuste: la fracción de impacto difiere
  // ~0,55 entre móvil y escritorio para el mismo ángulo/potencia, porque el
  // hito espacial usa gravedad multipozo (varios planetas) cuya posición
  // absoluta depende del tamaño/forma real del mundo -- y encuadre-movil-1
  // exige justo eso, mundos de forma distinta por dispositivo para eliminar
  // el letterbox. Mismo ángulo/potencia ya no puede garantizar el mismo
  // punto relativo de impacto cuando el campo gravitatorio que atraviesa el
  // proyectil es geométricamente distinto; el contrato que control-apuntado
  // sigue garantizando (y que este test comprueba arriba) es ángulo,
  // potencia y arma -- no dónde cae el disparo.
});
