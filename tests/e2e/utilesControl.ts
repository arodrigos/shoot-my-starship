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
