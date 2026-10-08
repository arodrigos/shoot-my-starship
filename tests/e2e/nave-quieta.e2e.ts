import { test, expect } from "@playwright/test";
import { arrastrarDesdeNave } from "./utilesApuntado";

// qui-1: disparar no mueve ni roza a quien dispara. Un tiro hacia atrás sale
// rozando la silueta propia, que es justo donde la gracia vieja se cerraba
// antes de tiempo. Solo se exige quietud si el tiro no vuelve a alcanzar al
// tirador (el autoimpacto por gravedad sigue siendo legítimo).
for (const angulo of [170, 135, 45]) {
  test(`nave-quieta: disparar a ${angulo}° deja al tirador en su sitio y sin roce propio`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });

    const antes = (await page.evaluate(() => window.__debug.naves))!.find((n) => n.id === 0)!;
    await arrastrarDesdeNave(page, 0, angulo, 60);
    const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
    await page.getByTestId("disparar").click();
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes, { timeout: 60000 });

    const eventos = (await page.evaluate(() => window.__debug.ultimosEventos)) ?? [];
    const leAlcanzo = eventos.some((e) => (e.tipo === "autoimpacto" && e.nave === 0) || (e.tipo === "impacto" && e.objetivo === 0));
    test.skip(leAlcanzo, "el tiro volvió y alcanzó al tirador: autoimpacto legítimo");

    expect(eventos.some((e) => e.tipo === "roce" && e.nave === 0)).toBe(false);
    expect(eventos.some((e) => e.tipo === "desplazamiento" && e.nave === 0)).toBe(false);
    const despues = (await page.evaluate(() => window.__debug.naves))!.find((n) => n.id === 0)!;
    expect(despues.x).toBe(antes.x);
    expect(despues.y).toBe(antes.y);
    expect(despues.integridad).toBe(antes.integridad);
  });
}
