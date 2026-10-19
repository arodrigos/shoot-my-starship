import { test, expect, type Page } from "@playwright/test";
import { arrastrarBarraHasta } from "./utilesControl";

// mov-5: con los propulsores apuntando contra la superficie el juego avisa y no
// deja gastar el turno; apuntando hacia fuera, la ruta es libre y el botón vale.
async function abrirPropulsores(page: Page): Promise<void> {
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
}

const TAMANOS = [
  { w: 360, h: 640 },
  { w: 820, h: 1180 },
  { w: 1180, h: 820 },
];

for (const t of TAMANOS) {
  test(`propulsores bloqueados contra la superficie (${t.w}x${t.h})`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: t.w, height: t.h });
    await abrirPropulsores(page);
    await arrastrarBarraHasta(page, "barra-potencia", 1);

    let bloqueado = false;
    let libre = false;
    for (const f of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      await arrastrarBarraHasta(page, "barra-angulo", f);
      await page.waitForFunction(() => window.__debug.previsualizacionPropulsores != null);
      const { motivo, corto } = await page.evaluate(() => {
        const previa = window.__debug.previsualizacionPropulsores!;
        const fin = previa.puntos[previa.puntos.length - 1];
        const nave = window.__debug.naves![0];
        return { motivo: previa.motivo, corto: Math.hypot(fin.x - nave.x, fin.y - (nave.y as number)) < 12 };
      });
      const turno = await page.evaluate(() => window.__debug.numeroTurno!);
      if (motivo === "obstaculo" && corto) {
        if (bloqueado) continue;
        bloqueado = true;
        await expect(page.getByTestId("disparar")).toBeDisabled();
        await expect(page.getByTestId("aviso-propulsores")).toBeVisible();
        await page.screenshot({ path: `capturas/bug-movimiento-naves-2-bloqueado-${t.w}x${t.h}.png` });
        expect(await page.evaluate(() => window.__debug.numeroTurno!)).toBe(turno);
      } else if (motivo !== "obstaculo" && !libre) {
        libre = true;
        await expect(page.getByTestId("disparar")).toBeEnabled();
        await page.screenshot({ path: `capturas/bug-movimiento-naves-2-libre-${t.w}x${t.h}.png` });
      }
    }
    expect(libre).toBe(true);
    expect(bloqueado).toBe(true);
  });
}
