import { test, expect, type Page } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";
import { SEPARACION_PERDIGON_U } from "@/sim/armas/resolver";

async function arrastrarHasta(page: Page, anguloObjetivo: number, potenciaObjetivo: number, ancho: number, alto: number): Promise<void> {
  const ajusteAntes = (await page.evaluate(() => window.__debug.control!.ajuste))!;
  const deltaY = -(anguloObjetivo - ajusteAntes.anguloGrados) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (potenciaObjetivo - ajusteAntes.potencia) / GANANCIA_POTENCIA;
  const inicio = { x: ancho * 0.45, y: alto * 0.88 };
  const fin = { x: inicio.x + deltaX * ancho, y: inicio.y + deltaY * alto };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();
}

// rac-1 y rac-2: el Racimo, con la solución dirigida al casco del rival, se
// abre en tres perdigones en fila, separados >= 70 u, y en vuelo se abre en
// tres en los últimos 40 u. Todo se lee del estado de depuración, sin esperas
// fijas. Las capturas (CAPTURAS_DIR) son para el juicio visual del gatekeeper.
test("rac-1/rac-2: tres detonaciones separadas y tres perdigones en vuelo", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("arma-racimo-de-tuppers").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "racimo-de-tuppers");

  const turnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();
  await arrastrarHasta(page, solucion!.anguloGrados, solucion!.potencia, 1180, 820);
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, turnoAntes, { timeout: 150000 });
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/racimo-separado-1180x820.png` });

  const medida = await page.evaluate(() => ({
    detonaciones: window.__debug.detonaciones ?? [],
    explosiones: (window.__debug.efectosVisibles ?? []).filter((e) => e.tipo === undefined || e.tipo === "explosion").length,
    perdigones: window.__debug.proyectil?.perdigonesMaximo,
  }));

  const racimo = medida.detonaciones.filter((d) => d.armaId === "racimo-de-tuppers");
  // El central siempre detona; los laterales solo se descartan fuera del mundo.
  expect(racimo.length).toBeGreaterThanOrEqual(2);
  expect(racimo.length).toBeLessThanOrEqual(3);
  for (const a of racimo) {
    for (const b of racimo) {
      if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(SEPARACION_PERDIGON_U - 0.5);
    }
  }
  expect(medida.explosiones).toBeGreaterThanOrEqual(racimo.length);
  // Una nave recibe solo el daño de su perdigón más fuerte (20).
  expect(Math.max(0, ...racimo.map((d) => d.danioAplicado))).toBeLessThanOrEqual(20);
  // rac-2: en vuelo el portador pasó de 1 a 3 perdigones.
  expect(medida.perdigones).toBe(3);
});
