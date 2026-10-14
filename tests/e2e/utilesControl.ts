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

// menu-ajustes: Histórico, Sacudida, Sonido, Música y Voz viven en el panel
// del botón ⚙. Idempotente: si ya está abierto no lo vuelve a pulsar (un
// segundo clic lo cerraría).
export async function abrirAjustes(page: Page): Promise<void> {
  const boton = page.getByTestId("boton-ajustes");
  if ((await boton.getAttribute("aria-expanded")) !== "true") {
    await boton.click();
  }
  await page.getByTestId("panel-ajustes").waitFor({ state: "visible" });
}

// Pulsa un interruptor del panel y lo vuelve a cerrar, para los specs que solo
// necesitan el efecto y no quieren dejar el panel tapando el resto del HUD.
export async function pulsarAjuste(page: Page, testId: string): Promise<void> {
  await abrirAjustes(page);
  await page.getByTestId(testId).click();
  await page.getByTestId("cerrar-ajustes").click();
  await page.getByTestId("panel-ajustes").waitFor({ state: "hidden" });
}
