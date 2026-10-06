import { test, expect } from "@playwright/test";
import { posicionPantallaNave } from "./utilesApuntado";

// pan-2 (camino crítico): de punta a punta con la consola plegada.
test("jugar-plegado: se apunta en el lienzo, se dispara desde la barra mínima, hay daño y pasa el turno", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });

  const boton = page.getByTestId("boton-plegar-consola");
  await boton.click();
  await expect(boton).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("barra-minima")).toBeVisible();

  const solucion = await page.evaluate(() => window.__debug.solucionMultipozoJugador!());
  expect(solucion && solucion.danio > 0, "la semilla debe tener una solución con daño").toBe(true);
  const { anguloGrados, potencia } = solucion!;
  const nave = await posicionPantallaNave(page, 0);
  const distancia = (potencia / 100) * 0.4 * 360;
  const rad = (anguloGrados * Math.PI) / 180;
  await page.mouse.move(nave.x + Math.cos(rad) * 20, nave.y - Math.sin(rad) * 20);
  await page.mouse.down();
  await page.mouse.move(nave.x + Math.cos(rad) * distancia * 0.5, nave.y - Math.sin(rad) * distancia * 0.5, { steps: 3 });
  await page.mouse.move(nave.x + Math.cos(rad) * distancia, nave.y - Math.sin(rad) * distancia, { steps: 3 });
  await page.mouse.up();

  const antes = await page.evaluate(() => ({ turno: window.__debug.numeroTurno ?? 0, rival: window.__debug.naves!.find((n) => n.id === 1)!.integridad }));
  await page.getByTestId("disparar").click();
  await expect(page.getByTestId("consola")).toHaveAttribute("data-oculta", "true");
  await page.waitForFunction((n) => window.__debug.animacionEnCurso === false && (window.__debug.numeroTurno ?? 0) >= n + 1, antes.turno, { timeout: 90000 });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true || window.__debug.naves!.some((n) => n.integridad <= 0), undefined, { timeout: 90000 });

  const despues = await page.evaluate(() => window.__debug.naves!.find((n) => n.id === 1)!.integridad);
  expect(despues).toBeLessThan(antes.rival);
  await expect(page.getByTestId("boton-plegar-consola")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("consola")).toHaveAttribute("data-oculta", "false");
});

test("jugar-plegado: con la consola desplegada, se aparta durante el vuelo y vuelve desplegada al terminar", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
  await expect(page.getByTestId("boton-plegar-consola")).toHaveAttribute("aria-expanded", "true");
  const turno = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  await expect(page.getByTestId("consola")).toHaveAttribute("data-oculta", "true");
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turno, { timeout: 90000 });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true || window.__debug.naves!.some((n) => n.integridad <= 0), undefined, { timeout: 90000 });
  await expect(page.getByTestId("consola")).toHaveAttribute("data-oculta", "false");
  await expect(page.getByTestId("boton-plegar-consola")).toHaveAttribute("aria-expanded", "true");
});
