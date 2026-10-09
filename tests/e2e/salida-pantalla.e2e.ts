import { test, expect, type Page } from "@playwright/test";
import { arrastrarDesdeNave } from "./utilesApuntado";

// salida-pantalla (sal-1, sal-2): un tiro casi vertical a potencia máxima sale
// por arriba. Debe perderse al cruzar el margen del borde, mostrar «¡Perdido!»
// y pasar el turno enseguida, sin segundos de pantalla quieta.
async function empezar(page: Page, reducido: boolean): Promise<void> {
  await page.emulateMedia({ reducedMotion: reducido ? "reduce" : "no-preference" });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.rendimiento !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

async function dispararHaciaArriba(page: Page): Promise<number> {
  // Se mira cuándo se publica el número de turno con un setter, no con un
  // sondeo: el sondeo heredaría el coste de cada fotograma del lienzo en el CI.
  await page.evaluate(() => {
    const depuracion = window.__debug as unknown as Record<string, unknown>;
    let valor = depuracion.numeroTurno;
    Object.defineProperty(depuracion, "numeroTurno", {
      configurable: true,
      get: () => valor,
      set: (nuevo) => {
        if (nuevo !== valor) (window as unknown as { __tTurno?: number }).__tTurno = performance.now();
        valor = nuevo;
      },
    });
  });
  const turnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await arrastrarDesdeNave(page, 0, 90, 220);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.avisoPerdido !== undefined, undefined, { timeout: 60000 });
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turnoAntes, { timeout: 30000 });
  return turnoAntes;
}

for (const reducido of [false, true]) {
  test(`sal-2: un tiro que sale por arriba se pierde y el turno pasa enseguida (movimiento reducido: ${reducido})`, async ({ page }) => {
    test.setTimeout(180000);
    await empezar(page, reducido);
    await dispararHaciaArriba(page);

    const medida = await page.evaluate(() => {
      const marca = [...window.__debug.rendimiento!.marcas].reverse().find((m) => m.nombre === "salida");
      return {
        tSalida: marca?.t ?? null,
        tTurno: (window as unknown as { __tTurno?: number }).__tTurno ?? null,
        aviso: window.__debug.avisoPerdido!,
        detonaciones: window.__debug.detonaciones?.length ?? 0,
        explosiones: (window.__debug.efectosVisibles ?? []).filter((e) => e.tipo === "explosion").length,
      };
    });
    expect(medida.tSalida, "la marca «salida» existe").not.toBeNull();
    expect(medida.tTurno, "se publicó el cambio de turno").not.toBeNull();
    // El resultado del turno se aplica de golpe: marca y turno van juntos.
    expect(Math.abs(medida.tTurno! - medida.tSalida!)).toBeLessThanOrEqual(500);
    expect(medida.aviso.borde).toBe("arriba");
    expect(medida.detonaciones).toBe(0);
    expect(medida.explosiones).toBe(0);
  });
}
