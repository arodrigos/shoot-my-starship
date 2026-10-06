import { test, expect } from "@playwright/test";
import { arrastrarBarraHasta } from "./utilesControl";

// esc-2 de punta a punta: círculo de alcance, ruta prevista y movimiento real.
test("propulsores: se dibuja el alcance y la nave vuela hasta donde dijo la previsualización", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId("equipo-propulsores").click();
  await expect(page.getByTestId("disparar")).toHaveText("Encender propulsores");

  // 0° con potencia 100: los extremos de las dos barras.
  await arrastrarBarraHasta(page, "barra-angulo", 0);
  await arrastrarBarraHasta(page, "barra-potencia", 1);
  await page.waitForFunction(() => window.__debug.previsualizacionPropulsores != null);

  const { alcance, mundo, previa, desde } = await page.evaluate(() => ({
    alcance: window.__debug.alcancePropulsores!,
    mundo: window.__debug.mundo!,
    previa: window.__debug.previsualizacionPropulsores!,
    desde: window.__debug.naves![0],
  }));
  expect(Math.abs(alcance - Math.sqrt((mundo.ancho * mundo.alto) / (4 * Math.PI)))).toBeLessThan(1);
  const finalPrevisto = previa.puntos[previa.puntos.length - 1];
  expect(Math.hypot(finalPrevisto.x - desde.x, finalPrevisto.y - (desde.y as number))).toBeLessThanOrEqual(alcance + 1);

  const turno = await page.evaluate(() => window.__debug.numeroTurno!);
  await page.getByTestId("disparar").click();
  // Se toma la posición en el primer fotograma tras el turno, antes de que la
  // respuesta de la IA (que va animada) pueda moverla.
  const manejador = await page.waitForFunction(
    (n) => ((window.__debug.numeroTurno ?? 0) > n ? { x: window.__debug.naves![0].x, y: window.__debug.naves![0].y } : null),
    turno,
    { timeout: 30000 },
  );
  const tras = (await manejador.jsonValue()) as { x: number; y: number };
  expect(Math.abs(tras.x - finalPrevisto.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(tras.y - finalPrevisto.y)).toBeLessThanOrEqual(2);
  expect(Math.hypot(tras.x - desde.x, tras.y - (desde.y as number))).toBeLessThanOrEqual(alcance + 1);
});
