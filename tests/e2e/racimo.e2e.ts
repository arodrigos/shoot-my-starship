import { test, expect, type Page } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";
import { RADIO_SUBMUNICION, DANIO_MAXIMO_RACIMO_COMBINADO } from "@/sim/armas/resolver";

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

// rac-1 y rac-2: el Racimo, con la solución dirigida al casco del rival,
// detona cinco veces pegado al impacto y en vuelo se abre en cinco perdigones
// en los últimos 40 u. Todo se lee del estado de depuración, sin esperas fijas.
test("rac-1/rac-2: cinco detonaciones juntas y cinco perdigones en vuelo", async ({ page }) => {
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

  const medida = await page.evaluate(() => ({
    detonaciones: window.__debug.detonaciones ?? [],
    explosiones: (window.__debug.efectosVisibles ?? []).filter((e) => e.tipo === undefined || e.tipo === "explosion").length,
    perdigones: window.__debug.proyectil?.perdigonesMaximo,
    impacto: window.__debug.ultimoDisparo?.impacto,
  }));

  const racimo = medida.detonaciones.filter((d) => d.armaId === "racimo-de-tuppers");
  expect(racimo).toHaveLength(5);
  for (const a of racimo) {
    for (const b of racimo) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThanOrEqual(1.5 * RADIO_SUBMUNICION + 1e-6);
    // El impacto publicado es el del perdigón central, que ya lleva su propia
    // variación (≤ 0,15 × radio): la cruz más las dos variaciones, no solo 0,75.
    expect(Math.hypot(a.x - medida.impacto!.x, a.y - medida.impacto!.y)).toBeLessThanOrEqual(0.9 * RADIO_SUBMUNICION + 1e-6);
  }
  expect(medida.explosiones).toBeGreaterThanOrEqual(5);
  const danioTotal = racimo.reduce((total, d) => total + d.danioAplicado, 0);
  expect(danioTotal).toBeLessThanOrEqual(DANIO_MAXIMO_RACIMO_COMBINADO);
  // rac-2: en vuelo el portador pasó de 1 a 5 perdigones.
  expect(medida.perdigones).toBe(5);
});
