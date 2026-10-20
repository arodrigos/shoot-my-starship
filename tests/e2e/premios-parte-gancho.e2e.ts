import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

// premios-parte (pp-1, pp-2, pp-3): el gancho forzarFinDePartida() también cierra
// una partida de cuatro asientos, que es el camino del paso premios-por-asiento
// del UAT. Las capturas se sacan aquí porque las del CI no se recuperan.
const VIEWPORTS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
];

for (const { ancho, alto } of VIEWPORTS) {
  test(`pp-1: forzarFinDePartida cierra una partida de 4 asientos y enseña cuatro tarjetas (${ancho}x${alto})`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/?muerte=1&modo=barra-libre");
    await page.getByTestId("humanos-4").click();
    for (const [i, nombre] of ["Ana", "Luis", "Marta", "Eva"].entries()) await page.getByTestId(`nombre-jugador-${i}`).pressSequentially(nombre);
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.forzarFinDePartida !== undefined);
    await page.evaluate(() => window.__debug.forzarFinDePartida!());
    await page.waitForFunction(() => window.__debug.parteDeGuerra != null, undefined, { timeout: 60000 });
    await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
    for (let asiento = 0; asiento < 4; asiento++) await expect(page.getByTestId(`premio-asiento-${asiento}`)).toBeVisible();
    const boton = await page.getByTestId("otra-partida").boundingBox();
    expect(boton).not.toBeNull();
    expect(boton!.y + boton!.height).toBeLessThanOrEqual(alto);
    mkdirSync("capturas", { recursive: true });
    await page.screenshot({ path: `capturas/premios-parte-15-final-${ancho}x${alto}.png` });
    await page.getByTestId("ver-numeros").click();
    for (let asiento = 0; asiento < 4; asiento++) await expect(page.getByTestId(`fila-numeros-${asiento}`)).toBeVisible();
    await page.screenshot({ path: `capturas/premios-parte-15-numeros-${ancho}x${alto}.png` });
  });
}
