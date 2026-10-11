import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// historico-mensajes (his-1..his-3): la hoja se mide con getBoundingClientRect
// y getComputedStyle sobre una partida real; el histórico largo se inyecta
// por el gancho de depuración porque jugar 15 turnos no aporta nada aquí.
const VIEWPORTS = {
  movil: { width: 360, height: 640 },
  ipadHorizontal: { width: 1180, height: 820 },
};

async function irAPartida(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.inyectarHistorico !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

// 15 turnos, cada uno con broma de disparo y de impacto = 30 mensajes; uno
// de 160 caracteres para comprobar que se parte en varias líneas.
async function inyectar30(page: Page): Promise<void> {
  await page.evaluate(() => {
    const largo = "Esta frase larguísima ".repeat(8).slice(0, 160);
    window.__debug.inyectarHistorico!(
      Array.from({ length: 15 }, (_, i) => ({
        numeroTurno: i,
        emisor: i % 2,
        disparo: i === 4 ? largo : `Disparo del turno ${i}`,
        impacto: `Impacto del turno ${i}`,
        categoriaImpacto: "resumen" as const,
      })),
    );
  });
}

test("his-1: hoja grande y legible a 360x640", async ({ page }) => {
  await irAPartida(page, VIEWPORTS.movil);
  await inyectar30(page);
  const toggle = page.getByTestId("historico-bromas-toggle");
  await expect(toggle).toHaveText("Histórico (30)");
  await toggle.click();
  const panel = page.getByTestId("historico-bromas");
  await expect(panel).toBeVisible();

  const medida = await panel.evaluate((el) => {
    const caja = el.getBoundingClientRect();
    const estilo = getComputedStyle(el);
    const log = el.querySelector('[role="log"]') as HTMLElement;
    const cajaLog = log.getBoundingClientRect();
    const enteros = Array.from(el.querySelectorAll('[data-testid="historico-bromas-mensaje"]')).filter((m) => {
      const c = m.getBoundingClientRect();
      return c.top >= cajaLog.top && c.bottom <= cajaLog.bottom;
    }).length;
    const texto = el.querySelector('[data-testid="historico-bromas-mensaje"]') as HTMLElement;
    return {
      alto: caja.height,
      ancho: caja.width,
      relleno: parseFloat(estilo.paddingLeft),
      fuente: parseFloat(getComputedStyle(texto).fontSize),
      enteros,
      desbordeHorizontal: log.scrollWidth > log.clientWidth,
      primerTurno: el.querySelector("section h3")?.textContent,
    };
  });
  expect(medida.alto).toBeGreaterThanOrEqual(448);
  expect(medida.alto).toBeLessThanOrEqual(544);
  expect(medida.ancho).toBeGreaterThanOrEqual(344);
  expect(medida.relleno).toBeGreaterThanOrEqual(12);
  expect(medida.fuente).toBeGreaterThanOrEqual(15);
  expect(medida.enteros).toBeGreaterThanOrEqual(6);
  expect(medida.desbordeHorizontal).toBe(false);
  expect(medida.primerTurno).toBe("Turno 15");

  // El mensaje largo ocupa varias líneas y se ve entero (sin recorte).
  const largo = page.getByTestId("historico-bromas-mensaje").filter({ hasText: "Esta frase larguísima" });
  await largo.scrollIntoViewIfNeeded();
  const cajaLargo = await largo.evaluate((el) => ({ alto: el.getBoundingClientRect().height, scroll: el.scrollHeight }));
  expect(cajaLargo.alto).toBeGreaterThan(30);
  expect(cajaLargo.scroll).toBeLessThanOrEqual(Math.ceil(cajaLargo.alto) + 1);

  await page.getByTestId("historico-bromas-cerrar").click();
  await expect(panel).toHaveCount(0);
  await expect(toggle).toBeFocused();
});

test("his-1: a 1180x820 mide como mucho 560 px y está centrada; Esc cierra; el emisor lleva el color de su asiento", async ({ page }) => {
  await irAPartida(page, VIEWPORTS.ipadHorizontal);
  await inyectar30(page);
  await page.getByTestId("historico-bromas-toggle").click();
  const panel = page.getByTestId("historico-bromas");
  const caja = await panel.boundingBox();
  expect(caja!.width).toBeLessThanOrEqual(560);
  expect(Math.abs(caja!.x + caja!.width / 2 - 590)).toBeLessThanOrEqual(2);
  expect(caja!.height).toBeGreaterThanOrEqual(0.7 * 820 - 1);

  const colores = await page.evaluate(() => window.__debug.naves!.map((n) => n.colorAsiento));
  const pintados = await page.getByTestId("historico-bromas-emisor").evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).color),
  );
  const aRgb = (hex: string): string => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  };
  // El turno más reciente (14) lo dice el asiento 0 y el anterior el 1.
  expect(pintados[0]).toBe(aRgb(colores[0]));
  expect(pintados[2]).toBe(aRgb(colores[1]));

  await page.getByTestId("historico-bromas-toggle").focus();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("his-2: sin mensajes explica qué aparecerá y ofrece Cerrar", async ({ page }) => {
  await irAPartida(page, VIEWPORTS.movil);
  await page.getByTestId("historico-bromas-toggle").click();
  await expect(page.getByTestId("historico-bromas-vacio")).toHaveText(
    "Aún no hay mensajes: aquí aparecerán las bromas y avisos de la partida.",
  );
  await expect(page.getByRole("button", { name: "Cerrar", exact: true })).toBeVisible();
});

test("his-3: diálogo con nombre, foco atrapado y sin violaciones serias de axe", async ({ page }) => {
  await irAPartida(page, VIEWPORTS.movil);
  await inyectar30(page);
  await page.getByTestId("historico-bromas-toggle").click();
  const panel = page.getByTestId("historico-bromas");
  await expect(panel).toHaveAttribute("role", "dialog");
  await expect(panel).toHaveAttribute("aria-labelledby", "historico-bromas-titulo");

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);

  const resultado = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const graves = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(graves.map((v) => v.id)).toEqual([]);
});
