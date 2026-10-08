import { test, expect, type Page } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

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

async function empezar(page: Page, ancho: number, alto: number, query = ""): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto(`/?mapa=calma-de-los-restos${query}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.rendimiento !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

const CASOS = [
  { nombre: "pepinazo 360x640", ancho: 360, alto: 640, arma: null },
  { nombre: "racimo 360x640", ancho: 360, alto: 640, arma: "racimo-de-tuppers" },
  { nombre: "racimo 1180x820", ancho: 1180, alto: 820, arma: "racimo-de-tuppers" },
] as const;

// par-1 (camino crítico): entre el impacto y el final de la explosión no hay
// frames largos. La ventana se lee de las marcas del propio medidor, no de
// esperas fijas: se sondea hasta que ha pasado 1 s real desde la marca.
for (const caso of CASOS) {
  test(`par-1: sin frames largos entre el impacto y la explosión (${caso.nombre})`, async ({ page }) => {
    test.setTimeout(150000);
    await empezar(page, caso.ancho, caso.alto);
    if (caso.arma) {
      await page.getByTestId("selector-arma-abrir").click();
      await page.getByTestId(`arma-${caso.arma}`).click();
      await page.waitForFunction((id) => window.__debug.control!.ajuste.armaId === id, caso.arma);
    }
    const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
    expect(solucion).not.toBeNull();
    await arrastrarHasta(page, solucion!.anguloGrados, solucion!.potencia, caso.ancho, caso.alto);
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await page.getByTestId("disparar").click();
    await page.waitForFunction(() => window.__debug.rendimiento!.marcas.some((m) => m.nombre === "explosion"), undefined, { timeout: 120000 });
    await page.waitForFunction(
      () => {
        const marcas = window.__debug.rendimiento!.marcas;
        const explosion = marcas.find((m) => m.nombre === "explosion");
        return explosion !== undefined && performance.now() - explosion.t >= 1000;
      },
      undefined,
      { timeout: 20000 },
    );
    const medida = await page.evaluate(() => {
      const r = window.__debug.rendimiento!;
      const impacto = r.marcas.find((m) => m.nombre === "impacto")!;
      const explosion = r.marcas.find((m) => m.nombre === "explosion")!;
      const ventana = r.deltas.filter((f) => f.t >= impacto.t && f.t <= explosion.t + 1000).map((f) => f.delta);
      const grandes = r.deltas
        .filter((f) => f.t >= impacto.t - 2000 && f.delta > 40)
        .map((f) => `${(f.t - impacto.t).toFixed(0)}ms:${f.delta.toFixed(0)}`);
      return { separacion: explosion.t - impacto.t, max: Math.max(0, ...ventana), frames: ventana.length, grandes };
    });
    console.log(`[par-1] ${caso.nombre}: max ${medida.max.toFixed(1)} ms en ${medida.frames} frames; grandes (desde el impacto): ${medida.grandes.join(" ")}`);
    expect(medida.separacion).toBeLessThanOrEqual(100);
    expect(medida.frames).toBeGreaterThan(0);
    expect(medida.max).toBeLessThanOrEqual(150);
  });
}

// par-4: el HUD de ?rendimiento=1 enseña p95 y max con números.
test("par-4: ?rendimiento=1 muestra el HUD con p95 y max numéricos", async ({ page }) => {
  await empezar(page, 360, 640, "&rendimiento=1");
  const hud = page.getByTestId("hud-rendimiento");
  await expect(hud).toBeVisible();
  await expect(hud).toHaveText(/p95 \d+(\.\d+)? ms\s+max \d+(\.\d+)? ms/);
});

test("par-4: sin ?rendimiento=1 no hay HUD", async ({ page }) => {
  await empezar(page, 360, 640);
  await expect(page.getByTestId("hud-rendimiento")).toHaveCount(0);
});
