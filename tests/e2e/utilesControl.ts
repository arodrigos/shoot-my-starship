import type { Page } from "@playwright/test";

// control-angulo-potencia: los dos controles nuevos (barra-angulo,
// barra-potencia) mapean la posición ABSOLUTA del puntero dentro de su
// propio rect a todo el rango del eje (ver anguloDesdeFraccionControl /
// potenciaDesdeFraccionControl) -- así que un solo gesto de down+move+up
// hacia la fracción objetivo basta para dejar el eje en cualquier valor,
// sin arrastre relativo ni estado de inicio que reproducir aquí. Se usa
// page.mouse en vez de locator.dragTo() por el mismo motivo documentado en
// control-4: la detección de "actionability" de Playwright es frágil bajo
// WebGL por software en este host.
export async function arrastrarBarraHasta(page: Page, testId: string, fraccion: number): Promise<void> {
  const caja = (await page.getByTestId(testId).boundingBox())!;
  const clienteY = caja.y + caja.height / 2;
  const fraccionSaturada = Math.max(0, Math.min(1, fraccion));
  const inicioX = caja.x + 1;
  const finX = caja.x + fraccionSaturada * caja.width;
  await page.mouse.move(inicioX, clienteY);
  await page.mouse.down();
  await page.mouse.move((inicioX + finX) / 2, clienteY, { steps: 4 });
  await page.mouse.move(finX, clienteY, { steps: 4 });
  await page.mouse.up();
}

// economia-loadout: en modo con presupuesto cada humano elige armas antes de
// jugar. Esto hace esa pantalla por la UI real (con la identificación previa
// si hay varios humanos) y la confirma; sin armas pulsa dos veces, que es lo
// que pide el aviso de «solo las 3 gratis».
export async function elegirArmasYConfirmar(page: Page, armas: readonly string[], conIdentificacion = false): Promise<void> {
  await page.getByTestId("pantalla-seleccion").waitFor({ state: "visible", timeout: 30000 });
  if (conIdentificacion) await page.getByTestId("seleccion-identificar").click();
  for (const arma of armas) await page.getByTestId(`seleccion-arma-${arma}`).click();
  await page.getByTestId("seleccion-confirmar").click();
  if (armas.length === 0) await page.getByTestId("seleccion-confirmar").click();
}
