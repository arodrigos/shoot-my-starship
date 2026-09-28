import { test } from "@playwright/test";

// proy-1 (requisito c de la sexta devolución del bloque proyectiles-visibles):
// captura de las 13 siluetas del catálogo en fila, dibujadas por la escena
// real de pruebas (Siluetas) con la misma llamada a fillPoints que usa
// AnimadorProyectil en vuelo -- no una comparación aparte de puntos. Se
// espera `siluetasListo` en vez de un timeout fijo (issue #151).
test("captura: las 13 siluetas del catálogo en fila", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 400 });
  await page.goto("/pruebas/siluetas");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.siluetasListo === true);
  await page.screenshot({ path: "capturas/proyectiles-visibles-13-proy1-siluetas-en-fila.png" });
});
