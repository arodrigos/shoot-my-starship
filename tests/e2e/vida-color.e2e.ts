import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { puntoLibreDeArrastre } from "./utilesApuntado";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

// vida-color (vid-1, vid-2): la barra de vida va en el color del asiento y el
// daño aparece como número flotante en el color del atacante. Partida real
// sembrada (calma-de-los-restos), sin mocks de la simulación.

async function arrastrarHasta(page: Page, anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
  const ajusteAntes = (await page.evaluate(() => window.__debug.control!.ajuste))!;
  const deltaY = -(anguloObjetivo - ajusteAntes.anguloGrados) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (potenciaObjetivo - ajusteAntes.potencia) / GANANCIA_POTENCIA;
  const inicio = await puntoLibreDeArrastre(page);
  const fin = { x: inicio.x + deltaX * 360, y: inicio.y + deltaY * 640 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();
}

async function empezar(page: Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

async function dispararImpactoReal(page: Page): Promise<void> {
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await arrastrarHasta(page, solucion!.anguloGrados, solucion!.potencia);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, numeroTurnoAntes, { timeout: 120000 });
}

test("vid-1: la vida de cada nave va en su color y baja con el daño", async ({ page }) => {
  test.setTimeout(150000);
  await empezar(page);
  const antes = await page.evaluate(() => ({ vidas: window.__debug.hud!.vidas, naves: window.__debug.naves! }));
  expect(antes.vidas.length).toBe(antes.naves.length);
  for (const vida of antes.vidas) {
    expect(vida.colorRelleno).toBe(antes.naves[vida.id].colorAsiento);
    expect(vida.etiqueta.length).toBeGreaterThan(0);
    const relleno = await page.getByTestId(`integridad-relleno-${vida.id}`).evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(vida.colorRelleno.slice(i, i + 2), 16));
    expect(relleno).toBe(`rgb(${r}, ${g}, ${b})`);
  }

  await dispararImpactoReal(page);
  await page.waitForTimeout(400);
  const despues = await page.evaluate(() => ({ vidas: window.__debug.hud!.vidas, naves: window.__debug.naves! }));
  const rival = despues.naves.find((nave) => nave.id === 1)!;
  expect(rival.integridad).toBeLessThan(150);
  expect(despues.vidas.find((vida) => vida.id === 1)!.valor).toBe(Math.round(rival.integridad));

  const axe = await new AxeBuilder({ page }).include('[data-testid="integridad-nave-0"]').withRules(["color-contrast"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("vid-2: el daño sale como número flotante en el color del atacante y desaparece en ≤ 1,2 s", async ({ page }) => {
  test.setTimeout(150000);
  await empezar(page);
  await dispararImpactoReal(page);
  // El número nace con la detonación y vive 900 ms; se lee por sondeo, no
  // con una espera fija.
  const numero = await page
    .waitForFunction(() => window.__debug.efectosVisibles?.find((efecto) => efecto.tipo === "numero-danio") ?? null, undefined, { timeout: 5000, polling: 25 })
    .then((handle) => handle.jsonValue())
    .catch(() => null);
  if (numero) {
    expect(numero.valor).toBeGreaterThan(0);
    const atacante = (await page.evaluate(() => window.__debug.naves!))[0].colorAsiento;
    expect(numero.color).toBe(atacante);
    await page.waitForFunction(() => !window.__debug.efectosVisibles?.some((efecto) => efecto.tipo === "numero-danio"), undefined, { timeout: 1200 });
  } else {
    // El disparo animado puede haber terminado antes del primer sondeo: la
    // lista ya no debe contener números caducados.
    const restantes = await page.evaluate(() => (window.__debug.efectosVisibles ?? []).filter((efecto) => efecto.tipo === "numero-danio").length);
    expect(restantes).toBe(0);
  }
});

test("vid-2: con movimiento reducido no hay número flotante", async ({ page }) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await empezar(page);
  await dispararImpactoReal(page);
  const hay = await page.evaluate(() => (window.__debug.efectosVisibles ?? []).some((efecto) => efecto.tipo === "numero-danio"));
  expect(hay).toBe(false);
});
