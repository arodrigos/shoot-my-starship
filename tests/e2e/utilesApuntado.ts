import type { Page } from "@playwright/test";

// Posición en pantalla (píxeles CSS) de una nave, medida contra el lienzo
// real: es lo único que el apuntado directo conoce.
export async function posicionPantallaNave(page: Page, id: number): Promise<{ x: number; y: number }> {
  const caja = (await page.locator("#game-container canvas").boundingBox())!;
  const { nave, mundo } = await page.evaluate((idNave) => ({ nave: window.__debug.naves!.find((n) => n.id === idNave)!, mundo: window.__debug.mundo! }), id);
  return { x: caja.x + (nave.x / mundo.ancho) * caja.width, y: caja.y + ((nave.y as number) / mundo.alto) * caja.height };
}

// pantalla-completa: con la consola desplegada (capa sobre el 45 % inferior del
// viewport) los eventos del lienzo bajo ella no llegan. Quien apunta arrastrando
// sobre la nave pliega antes la consola, como haría un jugador.
export async function plegarConsola(page: Page): Promise<void> {
  const boton = page.getByTestId("boton-plegar-consola");
  if ((await boton.getAttribute("aria-expanded")) === "true") await boton.click();
  await page.getByTestId("barra-minima").waitFor();
}

// Arrastra sobre el lienzo desde la nave del turno hasta un punto a
// `distancia` píxeles CSS en la dirección `grados` (0° a la derecha, 90°
// arriba). down+move+up reales, como un dedo.
export async function arrastrarDesdeNave(page: Page, id: number, grados: number, distancia: number): Promise<void> {
  const nave = await posicionPantallaNave(page, id);
  const rad = (grados * Math.PI) / 180;
  const destinoX = nave.x + Math.cos(rad) * distancia;
  const destinoY = nave.y - Math.sin(rad) * distancia;
  await page.mouse.move(nave.x + Math.cos(rad) * 20, nave.y - Math.sin(rad) * 20);
  await page.mouse.down();
  await page.mouse.move((nave.x + destinoX) / 2, (nave.y + destinoY) / 2, { steps: 3 });
  await page.mouse.move(destinoX, destinoY, { steps: 3 });
  await page.mouse.up();
}

// consola-compacta: la consola ocupa el 40 % del ancho y sus controles
// (barras de ángulo y potencia, botones) ya no dejan libres los puntos fijos
// que los tests usaban para el arrastre combinado. Busca un punto de la
// superficie de arrastre que no esté encima de ningún control, como haría un
// dedo que quiere apuntar y no pulsar un botón.
export async function puntoLibreDeArrastre(page: Page): Promise<{ x: number; y: number }> {
  const punto = await page.evaluate(() => {
    const superficie = document.querySelector<HTMLElement>('[data-testid="superficie-arrastre"]');
    if (superficie === null) return null;
    const caja = superficie.getBoundingClientRect();
    const centroX = caja.x + caja.width / 2;
    for (let y = caja.bottom - 6; y > caja.y + 6; y -= 6) {
      for (let desplazamiento = 0; desplazamiento < caja.width / 2 - 6; desplazamiento += 6) {
        for (const signo of [1, -1]) {
          const x = centroX + signo * desplazamiento;
          const elemento = document.elementFromPoint(x, y);
          if (elemento === null || !superficie.contains(elemento)) continue;
          if (elemento.closest('button, [role="slider"], input, select, a') !== null) continue;
          return { x, y };
        }
      }
    }
    return null;
  });
  if (punto === null) throw new Error("No hay ningún punto libre en la superficie de arrastre de la consola");
  return punto;
}
