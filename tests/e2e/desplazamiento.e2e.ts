import { test, expect } from "@playwright/test";
import { arrastrarDesdeNave } from "./utilesApuntado";

// des-3: tras un impacto con daño, la nave alcanzada se recoloca, queda la
// marca «Estaba aquí» y el resumen del turno lo dice. Mismo escenario que
// angulo-abajo (rival justo debajo del tirador a 360x640), que garantiza el daño.
test("desplazamiento: el rival dañado se recoloca, deja marca y el resumen lo dice", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();

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

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
  await arrastrarDesdeNave(page, 0, 270, 60);
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes, { timeout: 60000 });

  const eventos = await page.evaluate(() => window.__debug.ultimosEventos);
  const despl = eventos?.find((e) => e.tipo === "desplazamiento" && e.nave === 1);
  expect(despl, "el rival dañado emite un desplazamiento").toBeDefined();
  const rival = (await page.evaluate(() => window.__debug.naves))!.find((n) => n.id === 1)!;
  expect(Math.hypot(rival.x - colocacion!.x, rival.y - colocacion!.yRival)).toBeGreaterThan(1);

  await expect(page.getByTestId("fantasma-1")).toBeVisible();
  await expect(page.getByTestId("resultado-turno")).toContainText("salió despedida");
  // Captura opcional para quien juzga el criterio visual; el deslizamiento dura
  // 450 ms, así que se espera a que acabe antes de fotografiar.
  if (process.env.RUTA_CAPTURA) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: process.env.RUTA_CAPTURA });
  }
});
