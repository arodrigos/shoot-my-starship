import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

const LIMITE_MS = 200;
const VIEWPORTS = [
  { ancho: 360, alto: 640 },
  { ancho: 1180, alto: 820 },
];

async function entrarAPartida(page: Page, ancho: number, alto: number): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// Anota si el aviso «está apuntando…» llegó a existir en algún momento: el
// turno de la IA puede durar menos que un poll del test.
async function vigilarAvisoIA(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __vioAvisoIA: string | null }).__vioAvisoIA = null;
    new MutationObserver(() => {
      const aviso = document.querySelector('[data-testid="apuntando-ia"]');
      if (aviso?.textContent) (window as unknown as { __vioAvisoIA: string | null }).__vioAvisoIA = aviso.textContent;
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
}

// Espera a que el medidor registre las interacciones nuevas de un toque con su
// trabajoApp ya calculado (la entrada LoAF llega tras el fotograma).
async function esperarNuevas(page: Page, desde: number) {
  await page.waitForFunction((n) => {
    const lista = window.__debug.rendimiento!.interacciones;
    return lista.length > n && lista.slice(n).every((i) => i.trabajoApp !== null);
  }, desde, { timeout: 30000 });
  return page.evaluate((n) => window.__debug.rendimiento!.interacciones.slice(n), desde);
}

for (const vp of VIEWPORTS) {
  test(`res-1: ${vp.ancho}x${vp.alto} con CPU ×4, todo toque cuesta ≤ 200 ms de trabajo de la app, también con la IA pensando y en la explosión`, async ({ page }) => {
    test.setTimeout(420000);
    await vigilarAvisoIA(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await entrarAPartida(page, vp.ancho, vp.alto);

    // Turno del humano: el ángulo y el histórico responden.
    await page.getByTestId("paso-angulo-mas").click();
    await page.getByRole("button", { name: /Histórico/ }).click();
    await page.getByTestId("historico-bromas-cerrar").click();

    const antes = await page.evaluate(() => window.__debug.resultadoTurno);
    await page.getByTestId("disparar").click();

    // Durante el vuelo, la explosión y el turno de la IA: toques al lienzo y a la consola.
    for (let i = 0; i < 3; i++) {
      await page.locator("#game-container canvas").click({ position: { x: 20, y: 20 }, force: true });
    }
    if (await page.getByTestId("boton-ocultar-consola").isVisible()) {
      await page.getByTestId("boton-ocultar-consola").click();
      await page.getByTestId("pestana-consola").click();
    }
    await page.waitForFunction((previo) => window.__debug.resultadoTurno !== previo, antes, { timeout: 120000 });
    await page.waitForFunction(() => window.__debug.control?.puedeDisparar === true, undefined, { timeout: 120000 });

    const medida = await page.evaluate(() => ({
      interacciones: window.__debug.rendimiento!.interacciones,
      inp: window.__debug.rendimiento!.inp,
      base: window.__debug.rendimiento!.baseMaquetacion,
      modo: window.__debug.motor!.modo,
      aviso: (window as unknown as { __vioAvisoIA: string | null }).__vioAvisoIA,
    }));
    expect(medida.modo).toBe("trabajador");
    expect(medida.interacciones.length).toBeGreaterThanOrEqual(6);

    // Información: la respuesta completa, con el pintado por software del CI,
    // no se juzga aquí sino en el dispositivo con ?rendimiento=1.
    mkdirSync("test-results/respuesta", { recursive: true });
    writeFileSync(
      `test-results/respuesta/${vp.ancho}x${vp.alto}.json`,
      JSON.stringify({ baseMaquetacion: medida.base, inp: medida.inp, interacciones: medida.interacciones.map(({ tipo, objetivo, trabajoApp, duracion, retrasoEntrada, renderLienzo }) => ({ tipo, objetivo, trabajoApp, duracion, retrasoEntrada, renderLienzo })) }, null, 1),
    );

    // En Chromium siempre hay LoAF: un null sería una medida rota, no un permiso.
    const sinMedida = medida.interacciones.filter((i) => i.trabajoApp === null);
    expect(sinMedida.length, "interacciones sin trabajoApp").toBe(0);
    const lentas = medida.interacciones.filter((i) => (i.trabajoApp ?? 0) > LIMITE_MS);
    const peor = [...medida.interacciones].sort((x, y) => (y.trabajoApp ?? 0) - (x.trabajoApp ?? 0)).slice(0, 5);
    const resumen = peor.map((i) => `${i.objetivo.slice(0, 18)} ${i.tipo[0]} app=${Math.round(i.trabajoApp ?? 0)} dur=${Math.round(i.duracion)} lienzo=${Math.round(i.renderLienzo)}`).join(" | ");
    expect(lentas.length, `base=${Math.round(medida.base)} ${resumen}`).toBe(0);
    expect(medida.aviso).toMatch(/está apuntando…$/);

    // Control 1: un toque sin acción no cuenta el rasterizador del CI.
    const antesControl = medida.interacciones.length;
    await page.mouse.click(2, vp.alto - 2);
    const control = await esperarNuevas(page, antesControl);
    const peorControl = Math.max(...control.map((i) => i.trabajoApp ?? Infinity));
    expect(peorControl, "toque de control").toBeLessThanOrEqual(100);

    // Control 2: el centinela demuestra que la medida caza un bloqueo real.
    await page.evaluate(() => window.__debug.bloquearHilo!(300));
    await page.mouse.click(2, vp.alto - 2);
    const centinela = await esperarNuevas(page, antesControl + control.length);
    const peorCentinela = Math.max(...centinela.map((i) => i.trabajoApp ?? 0));
    expect(peorCentinela, "centinela bloquearHilo(300)").toBeGreaterThanOrEqual(280);
    expect(peorCentinela > LIMITE_MS, "el evaluador marca el centinela como fallo").toBe(true);
  });
}

test("res-3: con ?rendimiento=1 el HUD da el veredicto con números y se pone rojo con un bloqueo", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?rendimiento=1");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.rendimiento !== undefined, undefined, { timeout: 60000 });
  const hud = page.getByTestId("hud-rendimiento");
  await expect(hud).toContainText("INP");
  await expect(hud).toContainText("máx duración");
  await expect(hud).toContainText("máx retraso");
  await page.evaluate(() => window.__debug.bloquearHilo!(400));
  await page.mouse.click(2, 636);
  await expect(hud).toContainText("Supera 200 ms", { timeout: 30000 });
  await expect(hud).toHaveAttribute("data-veredicto", "rojo");
});

test("res-4: sin Worker el juego sigue funcionando con el adaptador en línea", async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    delete (window as unknown as { Worker?: unknown }).Worker;
  });
  await entrarAPartida(page, 360, 640);
  expect(await page.evaluate(() => window.__debug.motor!.modo)).toBe("en-linea");
  const antes = await page.evaluate(() => window.__debug.resultadoTurno);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((previo) => window.__debug.resultadoTurno !== previo, antes, { timeout: 120000 });
  await page.waitForFunction(() => window.__debug.control?.puedeDisparar === true, undefined, { timeout: 120000 });
});
