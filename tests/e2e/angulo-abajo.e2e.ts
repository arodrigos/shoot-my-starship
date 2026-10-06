import { test, expect } from "@playwright/test";
import { arrastrarDesdeNave } from "./utilesApuntado";

// apu-1 (camino crítico): el caso de prueba de Adrián, parte B del 360° --
// con el rival justo debajo del tirador a 360x640, un disparo apuntado hacia
// abajo con el arrastre directo le hace daño.
test("angulo-abajo: rival justo debajo del tirador a 360x640, el disparo hacia abajo le hace daño", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();

  // Tirador en (0,5·ancho, 0,30·alto) y rival 200 u más abajo, buscando la
  // columna más cercana al centro donde ni el casco ni el segmento que los
  // une quedan a menos de 60 u de un planeta ni dentro de un sólido.
  const colocacion = await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    const planetas = window.__debug.planetas ?? [];
    const yTirador = 0.3 * mundo.alto;
    const yRival = yTirador + 200;
    const despejada = (x: number): boolean => {
      for (let y = yTirador; y <= yRival; y += 10) {
        if (window.__debug.terreno!.esSolido(Math.round(x), Math.round(y))) return false;
        for (const planeta of planetas) if (Math.hypot(x - planeta.cx, y - planeta.cy) < planeta.radio + 60) return false;
      }
      return true;
    };
    for (let dx = 0; dx <= mundo.ancho * 0.4; dx += 10) {
      for (const x of dx === 0 ? [mundo.ancho / 2] : [mundo.ancho / 2 + dx, mundo.ancho / 2 - dx]) {
        if (!despejada(x)) continue;
        window.__debug.forzarPosicionNave!(0, x, yTirador);
        window.__debug.forzarPosicionNave!(1, x, yRival);
        return { x, yTirador, yRival };
      }
    }
    return null;
  });
  expect(colocacion, "no hay columna despejada para colocar al rival justo debajo").not.toBeNull();

  const integridadAntes = (await page.evaluate(() => window.__debug.naves))!.find((n) => n.id === 1)!.integridad;
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });

  // 60 px CSS hacia abajo desde la nave: ángulo 270° y potencia moderada.
  await arrastrarDesdeNave(page, 0, 270, 60);
  const angulo = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
  expect(Math.abs(angulo - 270)).toBeLessThanOrEqual(0.5);
  // El ajuste fino deja exactamente 270,0° como pide el caso.
  for (let toque = 0; toque < 5; toque++) {
    const actual = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
    if (Math.abs(actual - 270) < 0.05) break;
    await page.getByTestId(actual < 270 ? "paso-angulo-mas" : "paso-angulo-menos").click();
  }
  await expect(page.getByTestId("valor-angulo")).toHaveText("270,0°");

  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes, { timeout: 60000 });

  const integridadDespues = (await page.evaluate(() => window.__debug.naves))!.find((n) => n.id === 1)!.integridad;
  expect(integridadDespues).toBeLessThan(integridadAntes);
  const eventos = await page.evaluate(() => window.__debug.ultimosEventos);
  expect(eventos?.some((e) => e.tipo === "impacto" && e.objetivo === 1 && e.danio > 0)).toBe(true);
});
