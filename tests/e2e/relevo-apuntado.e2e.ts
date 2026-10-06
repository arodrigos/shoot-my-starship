import { test, expect, type Page } from "@playwright/test";
import { arrastrarDesdeNave, plegarConsola } from "./utilesApuntado";

async function esperarJugable(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
}

async function confirmarRelevo(page: Page): Promise<void> {
  await expect(page.getByTestId("pantalla-relevo")).toBeVisible({ timeout: 30000 });
  await page.getByTestId("relevo-confirmar").click();
  await expect(page.getByTestId("pantalla-relevo")).toHaveCount(0);
}

// apu-3 + apu-6: con dos humanos el relevo no arrastra el apuntado del
// anterior, y la ayuda de una línea sale una vez por asiento.
test("relevo-apuntado: cada asiento recupera su ángulo y potencia; la ayuda sale una vez por asiento", async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 360, height: 640 });
  // Modo espacial: allí la altura de la nave en __debug es la de su centro,
  // que es lo que el apuntado directo mide.
  await page.goto("/");
  await page.getByTestId("humanos-2").click();
  await page.getByTestId("ias-0").click();
  await page.getByTestId("nombre-jugador-0").pressSequentially("Ana");
  await page.getByTestId("nombre-jugador-1").pressSequentially("Luis");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await esperarJugable(page);
  // El plegado se recuerda entre asientos (localStorage), así que basta una vez.
  await plegarConsola(page);

  // apu-6: aparece en el primer turno de Ana.
  const textoAyuda = "Arrastra desde tu nave hacia donde quieras disparar: más lejos, más fuerte";
  await expect(page.getByTestId("ayuda-apuntado")).toContainText(textoAyuda);
  await page.getByTestId("ayuda-apuntado-cerrar").click();
  await expect(page.getByTestId("ayuda-apuntado")).toHaveCount(0);

  // Ana fija ~120°/80 (distancia 115 px = 80 % de 0,4 × 360) y dispara.
  await arrastrarDesdeNave(page, 0, 120, 115.2);
  const ana = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(Math.abs(ana.anguloGrados - 120)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(ana.potencia - 80)).toBeLessThanOrEqual(1);
  const turnoAna = await page.evaluate(() => window.__debug.numeroTurno!);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turnoAna, { timeout: 30000 });

  await confirmarRelevo(page);
  await esperarJugable(page);

  // Luis empieza en 45°/50, no en lo de Ana.
  const luisInicial = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(luisInicial.anguloGrados).toBe(45);
  expect(luisInicial.potencia).toBe(50);
  // La ayuda es de cada asiento: Luis la ve aunque Ana la cerrara.
  await expect(page.getByTestId("ayuda-apuntado")).toBeVisible();
  await page.getByTestId("ayuda-apuntado-cerrar").click();

  await arrastrarDesdeNave(page, 1, 300, 28.8);
  const luis = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(Math.abs(luis.anguloGrados - 300)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(luis.potencia - 20)).toBeLessThanOrEqual(1);
  const turnoLuis = await page.evaluate(() => window.__debug.numeroTurno!);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turnoLuis, { timeout: 30000 });

  await confirmarRelevo(page);
  await esperarJugable(page);

  // Al volver, Ana ve lo suyo y la ayuda no reaparece.
  const anaDeNuevo = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(anaDeNuevo.anguloGrados).toBeCloseTo(ana.anguloGrados, 5);
  expect(anaDeNuevo.potencia).toBeCloseTo(ana.potencia, 5);
  await expect(page.getByTestId("ayuda-apuntado")).toHaveCount(0);
});
