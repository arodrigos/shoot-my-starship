import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { abrirAjustes } from "./utilesControl";

// musica-tension (mus-2): las capas entran con el aviso de muerte súbita, una
// nave con poca vida y un duelo. El gatekeeper no oye: se verifica con
// __debug.musica().
async function jugar(page: Page): Promise<void> {
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.musica !== undefined && window.__debug.fijarMuerteSubita !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await expect.poll(() => page.evaluate(() => window.__debug.musica!().estado), { timeout: 10000, intervals: [50, 100] }).toBe("sonando");
}

test("mus-2: el duelo con vida baja y aviso de muerte súbita sube las capas en menos de un compás", async ({ page }) => {
  mkdirSync("capturas", { recursive: true });
  await page.setViewportSize({ width: 360, height: 640 });
  await jugar(page);
  const antes = await page.evaluate(() => window.__debug.musica!());
  expect(antes.nivelTension).toBe(0);
  expect(antes.capas).toEqual({ percusion: 0, bajo: 0 });
  await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 13, integridades: [20, 100] }));
  // Un compás a 90 BPM son 2,67 s; el margen cubre el reloj de CI.
  await expect
    .poll(() => page.evaluate(() => window.__debug.musica!().nivelTension), { timeout: 3500, intervals: [50, 100] })
    .toBe(3);
  const despues = await page.evaluate(() => window.__debug.musica!());
  expect(despues.capas.percusion).toBeGreaterThan(0);
  expect(despues.capas.bajo).toBeGreaterThan(0);
  expect(despues.bpm).toBe(100);
  await page.screenshot({ path: "capturas/musica-tension-15-aviso-muerte-subita-360x640.png" });

  // Con «Música» apagada no se programa ninguna nota más.
  await abrirAjustes(page);
  await page.getByTestId("toggle-musica").click();
  const trasParar = await page.evaluate(() => window.__debug.musica!().notasProgramadas);
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => window.__debug.musica!().notasProgramadas)).toBe(trasParar);
});
