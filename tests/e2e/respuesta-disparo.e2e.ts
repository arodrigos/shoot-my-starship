import { test, expect, type Page } from "@playwright/test";

// respuesta-disparo (rsp-1, 3, 4, 6): con un minirobot posado junto al rival el
// cierre del turno es lo caro; el proyectil tiene que salir antes de que acabe.
async function abrirConRobot(page: Page, query: string): Promise<void> {
  await page.goto(`/?modo=barra-libre${query}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    window.__debug.cargarEscenario!({
      naves: [
        { x: 120, y: mundo.alto / 2, integridad: 150 },
        { x: mundo.ancho - 120, y: mundo.alto / 2, integridad: 150 },
      ],
      arma: "pepinazo-cortesia",
      anguloGrados: 45,
      potencia: 60,
      robots: [{ x: mundo.ancho - 160, y: mundo.alto / 2, dueno: 0 }],
    });
  });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
}

const TAMANOS = [
  { w: 360, h: 640 },
  { w: 820, h: 1180 },
  { w: 1180, h: 820 },
];

for (const t of TAMANOS) {
  test(`el proyectil sale rápido y el hilo no se bloquea (${t.w}x${t.h})`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: t.w, height: t.h });
    await abrirConRobot(page, "&rendimiento=1");
    await page.getByTestId("disparar").click();
    await page.waitForFunction(() => window.__debug.proyectilEnVuelo != null, undefined, { timeout: 10000 });
    const tareasAlSalir = await page.evaluate(() => window.__debug.tareasLargas!);
    test.info().annotations.push({ type: "tareas-al-salir", description: JSON.stringify(tareasAlSalir) });
    await page.screenshot({ path: `capturas/bug-respuesta-disparo-7-salida-${t.w}x${t.h}.png` });
    const ms = await page.evaluate(() => window.__debug.latencias!().filter((l) => l.nombre === "disparo").at(-1)?.ms);
    expect(ms).toBeDefined();
    expect(ms!).toBeLessThanOrEqual(1000); // el límite de 200 ms lo mide el gatekeeper con la máquina libre
    await expect(page.getByTestId("hud-rendimiento")).toContainText("disparo");
    await page.screenshot({ path: `capturas/bug-respuesta-disparo-7-panel-${t.w}x${t.h}.png` });
    await page.waitForFunction(() => window.__debug.numeroTurno! > 1, undefined, { timeout: 90000 });
    const tareas = await page.evaluate(() => window.__debug.tareasLargas!);
    test.info().annotations.push({ type: "tareas-fin", description: JSON.stringify(tareas) });
    expect(tareas.maxMs, JSON.stringify({ alSalir: tareasAlSalir, fin: tareas })).toBeLessThanOrEqual(200);
  });
}

test("píldora «Calculando el turno…» con el cierre retrasado (360x640)", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await abrirConRobot(page, "");
  await page.evaluate(() => window.__debug.retardarCierreTurno!(6000));
  await page.getByTestId("disparar").click();
  await expect(page.getByTestId("calculando-turno")).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: "capturas/bug-respuesta-disparo-7-calculando-360x640.png" });
  await expect(page.getByTestId("calculando-turno")).toBeHidden({ timeout: 30000 });
});
