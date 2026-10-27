import { test, expect, type Page } from "@playwright/test";
import { instalarVibracionFalsa, leerVibracionesFalsas } from "../utils/vibracionFalsa";

test.use({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });

async function entrar(page: Page): Promise<void> {
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.vibracion !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

const instantanea = (page: Page) => page.evaluate(() => window.__debug.vibracion!());

test("vib-1: «Disparar» hace una sola llamada con el patrón de disparo, en el mismo manejador del clic", async ({ page }) => {
  test.setTimeout(120000);
  await instalarVibracionFalsa(page, "con-api");
  await entrar(page);
  await page.evaluate(() => {
    document.addEventListener("click", () => ((window as unknown as { __clic: number }).__clic = performance.now()), true);
  });
  await page.getByTestId("disparar").click();
  await expect.poll(async () => (await leerVibracionesFalsas(page)).length).toBe(1);
  const [v] = await leerVibracionesFalsas(page);
  expect(v.patron).toEqual([15]);
  const clic = await page.evaluate(() => (window as unknown as { __clic: number }).__clic);
  expect(v.t - clic).toBeLessThanOrEqual(16);
  const s = await instantanea(page);
  expect(s.llamadas).toHaveLength(1);
  expect(s.llamadas[0]).toMatchObject({ tipo: "disparo", aceptada: true });
});

test("vib-2: un impacto con daño sobre una nave vibra una vez; dos seguidos (racimo) se reducen a uno", async ({ page }) => {
  test.setTimeout(120000);
  await instalarVibracionFalsa(page, "con-api");
  await entrar(page);
  await page.evaluate(() => {
    window.__debug.dispararEventoImpactoReal!(1, 200, 300, 30);
    window.__debug.dispararEventoImpactoReal!(1, 205, 300, 30);
  });
  const llamadas = (await instantanea(page)).llamadas;
  expect(llamadas.map((l) => l.tipo)).toEqual(["impacto"]);
  expect(llamadas[0].patron).toEqual([25, 40, 25]);
});

test("vib-2: una detonación junto a la nave (daño sin tocar la silueta) también vibra", async ({ page }) => {
  test.setTimeout(120000);
  await instalarVibracionFalsa(page, "con-api");
  await entrar(page);
  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 17, false));
  const llamadas = (await instantanea(page)).llamadas;
  expect(llamadas.map((l) => l.tipo)).toEqual(["impacto"]);
  expect(llamadas[0].patron).toEqual([25, 40, 25]);
});

test("vib-2: un impacto sin daño no vibra", async ({ page }) => {
  test.setTimeout(120000);
  await instalarVibracionFalsa(page, "con-api");
  await entrar(page);
  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 0));
  expect((await instantanea(page)).llamadas).toHaveLength(0);
});

test("vib-4: con reduced-motion no se vibra, y al quitarlo se reactiva", async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await instalarVibracionFalsa(page, "con-api");
  await entrar(page);
  await page.getByTestId("disparar").click();
  await page.waitForTimeout(500);
  expect(await leerVibracionesFalsas(page)).toHaveLength(0);
  expect(await instantanea(page)).toMatchObject({ activa: false, motivoApagada: "movimiento-reducido", llamadas: [] });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await instantanea(page)).movimientoReducido).toBe(false);
  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 30));
  expect((await leerVibracionesFalsas(page)).length).toBe(1);
});

test("vib-5: sin API (como iPad) no hay llamadas ni errores", async ({ page }) => {
  test.setTimeout(120000);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  await instalarVibracionFalsa(page, "sin-api");
  await entrar(page);
  await page.getByTestId("disparar").click();
  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 30));
  expect(await instantanea(page)).toMatchObject({ soportada: false, activa: false, motivoApagada: "no-soportada", llamadas: [] });
  expect(errores).toEqual([]);
});

test("vib-5: si el navegador rechaza, las llamadas quedan con aceptada=false sin errores", async ({ page }) => {
  test.setTimeout(120000);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await instalarVibracionFalsa(page, "rechaza");
  await entrar(page);
  await page.getByTestId("disparar").click();
  await expect.poll(async () => (await instantanea(page)).llamadas.length).toBe(1);
  expect((await instantanea(page)).llamadas[0].aceptada).toBe(false);
  expect(errores).toEqual([]);
});

test("vib-6: preferencia corrupta no rompe el arranque y el gancho no expone nada para vibrar", async ({ page }) => {
  test.setTimeout(120000);
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await instalarVibracionFalsa(page, "con-api");
  await page.addInitScript(() => localStorage.setItem("vibracion:activa", "{basura"));
  await entrar(page);
  const s = await instantanea(page);
  expect(s.preferencia).toBe(true);
  expect(Object.values(s).some((v) => typeof v === "function")).toBe(false);
  const claves = await page.evaluate(() => Object.keys(window.__debug));
  for (const prohibida of ["vibrar", "fijarVibracionActiva", "reiniciarVibracion"]) expect(claves).not.toContain(prohibida);
  expect(errores).toEqual([]);
});

test("vib-5: en escritorio (sin pantalla táctil) con API no está soportada", async ({ browser }) => {
  test.setTimeout(120000);
  const contexto = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: false });
  const page = await contexto.newPage();
  await instalarVibracionFalsa(page, "con-api");
  await entrar(page);
  expect(await instantanea(page)).toMatchObject({ soportada: false, motivoApagada: "no-soportada" });
  await contexto.close();
});
