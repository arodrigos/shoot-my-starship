import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// hud-canales: HUD partido en canal de estado (permanente) y canal pasivo
// (la broma, efímera) -- ver diseño del bloque para el detalle de los 5
// criterios. Mismos helpers que layout-dos-zonas.e2e.ts (partida real
// sembrada, nunca un mock de la simulación): un turno real es la única forma
// honesta de comprobar que el canal de estado cambia de verdad.
const VIEWPORT_MOVIL = { width: 360, height: 640 };

async function irAPartida(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORT_MOVIL);
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

async function dispararTurnoReal(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  const bromasAntes = (await page.evaluate(() => window.__debug.historialBromas?.length ?? 0)) as number;
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    (antes) => (window.__debug.historialBromas?.length ?? 0) > antes,
    bromasAntes,
    { timeout: 60000 },
  );
}

test("hud-canales-1: el canal de estado es permanente y la broma se desvanece sola en <=6s", async ({ page }) => {
  test.setTimeout(60000);
  await irAPartida(page);

  await expect(page.getByTestId("canal-estado")).toBeVisible();
  await expect(page.getByTestId("integridad-nave-0")).toBeVisible();
  await expect(page.getByTestId("integridad-nave-1")).toBeVisible();

  await dispararTurnoReal(page);
  await expect(page.getByTestId("canal-estado")).toBeVisible();
  await expect(page.getByTestId("panel-bromas")).toBeVisible();

  await page.screenshot({ path: "capturas/hud-canales-1-360x640.png" });

  // Se espera a que también resuelva el turno de la máquina -- su propia
  // broma reiniciaría el temporizador de desvanecido, igual que lay-4 espera
  // lo mismo antes de descartar a mano (misma carrera real, no del test).
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="panel-bromas"]') === null,
    undefined,
    { timeout: 7000 },
  );
  await expect(page.getByTestId("canal-estado")).toBeVisible();
});

test("hud-canales-2: disparar cambia el indicador de turno y el histórico gana una entrada", async ({ page }) => {
  test.setTimeout(60000);
  await irAPartida(page);

  const turnoAntes = await page.evaluate(() => window.__debug.turno);
  expect(await page.evaluate(() => window.__debug.historialBromas?.length ?? 0)).toBe(0);

  await dispararTurnoReal(page);

  const turnoDespues = await page.evaluate(() => window.__debug.turno);
  expect(turnoDespues).not.toBe(turnoAntes);
  expect(await page.evaluate(() => window.__debug.historialBromas?.length ?? 0)).toBeGreaterThanOrEqual(1);
});

test("hud-canales-3: histórico de bromas vacío al empezar, dos entradas en orden tras dos disparos", async ({
  page,
}) => {
  test.setTimeout(90000);
  await irAPartida(page);

  // hud-canales-3: "accesible desde el canal de estado" -- un botón ahí
  // mismo, no una fila permanente (lay-5 no deja presupuesto de alto para
  // una fila más en 360x640).
  await page.getByTestId("historico-bromas-toggle").click();
  await expect(page.getByTestId("historico-bromas-vacio")).toHaveText("Aún no hay mensajes en esta partida");
  await page.getByTestId("historico-bromas-cerrar").click();

  await dispararTurnoReal(page);
  await page.getByTestId("historico-bromas-toggle").click();
  await expect(page.getByTestId("historico-bromas-entrada-0")).toBeVisible();
  await page.getByTestId("historico-bromas-cerrar").click();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await dispararTurnoReal(page);
  await page.getByTestId("historico-bromas-toggle").click();
  await expect(page.getByTestId("historico-bromas-entrada-1")).toBeVisible();
});

test("hud-canales-4: sin violaciones de target-size/color-contrast y el cierre de la broma no se sale del panel", async ({
  page,
}) => {
  test.setTimeout(60000);
  await irAPartida(page);
  await dispararTurnoReal(page);

  const resultados = await new AxeBuilder({ page }).withRules(["target-size", "color-contrast"]).analyze();
  expect(resultados.violations).toEqual([]);

  const panel = page.getByTestId("panel-bromas");
  if (await panel.isVisible().catch(() => false)) {
    const cajaPanel = (await panel.boundingBox())!;
    const cajaDescartar = (await page.getByTestId("broma-descartar").boundingBox())!;
    expect(cajaDescartar.x).toBeGreaterThanOrEqual(cajaPanel.x - 1);
    expect(cajaDescartar.y).toBeGreaterThanOrEqual(cajaPanel.y - 1);
    expect(cajaDescartar.x + cajaDescartar.width).toBeLessThanOrEqual(cajaPanel.x + cajaPanel.width + 1);
    expect(cajaDescartar.y + cajaDescartar.height).toBeLessThanOrEqual(cajaPanel.y + cajaPanel.height + 1);

    const desborde = await panel.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(desborde).toBe(false);
  }
});

test("hud-canales-5: disparar durante un vuelo en curso explica la causa y no encola un segundo disparo", async ({
  page,
}) => {
  test.setTimeout(60000);
  await irAPartida(page);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === false);

  await expect(page.getByTestId("aviso-accion-imposible")).toBeVisible();
  const texto = (await page.getByTestId("aviso-accion-imposible").textContent())!.toLowerCase();
  expect(texto).toContain("espera");
  await expect(page.getByTestId("disparar")).toBeDisabled();
});
