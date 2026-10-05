import type { Page } from "@playwright/test";

// Posición en pantalla (píxeles CSS) de una nave, medida contra el lienzo
// real: es lo único que el apuntado directo conoce.
export async function posicionPantallaNave(page: Page, id: number): Promise<{ x: number; y: number }> {
  const caja = (await page.locator("#game-container canvas").boundingBox())!;
  const { nave, mundo } = await page.evaluate((idNave) => ({ nave: window.__debug.naves!.find((n) => n.id === idNave)!, mundo: window.__debug.mundo! }), id);
  return { x: caja.x + (nave.x / mundo.ancho) * caja.width, y: caja.y + ((nave.y as number) / mundo.alto) * caja.height };
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
