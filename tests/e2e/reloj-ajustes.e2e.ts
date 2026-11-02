import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// reloj-ajustes-avisos: rel-1, rel-3, rel-4 y rel-5. Se juega por la portada
// real, en el mapa sembrado de siempre.
const MAPA_SEMBRADO = "calma-de-los-restos";

async function empezar(page: Page, tam: { width: number; height: number }, reloj: "off" | 30): Promise<void> {
  await page.setViewportSize(tam);
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("humanos-1").click();
  await page.getByTestId("ias-1").click();
  await page.getByTestId(`reloj-${reloj}`).click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
}

test("rel-1: con ⚙ abierto el reloj se pausa, no hay disparo automático y al cerrar sigue desde el mismo restante", async ({ page }) => {
  test.setTimeout(120000);
  mkdirSync("capturas", { recursive: true });
  await empezar(page, { width: 360, height: 640 }, 30);
  await page.waitForFunction(() => window.__debug.relojTurno!.estado === "corriendo");
  await page.evaluate(() => window.__debug.adelantarRelojTurno!(10000));
  await page.getByTestId("boton-ajustes").click();
  const panel = page.getByTestId("reloj-en-pausa");
  await expect(panel).toBeVisible();
  const pausado = await page.evaluate(() => window.__debug.relojTurno!);
  expect(pausado.estado).toBe("pausado");
  // Entre el arranque del turno y ⚙ pasan unos segundos reales: el panel debe
  // mostrar el restante que de verdad tiene el reloj, no uno fijo.
  expect(pausado.restanteMs).toBeLessThanOrEqual(20000);
  const seg = Math.ceil(pausado.restanteMs / 1000);
  await expect(panel).toHaveText(`Reloj en pausa · 0:${String(seg).padStart(2, "0")}`);
  const disparoAntes = await page.evaluate(() => window.__debug.ultimoDisparo ?? null);

  await page.waitForTimeout(1500);
  // El atajo de e2e no gasta tiempo con el reloj pausado: tampoco se agota.
  await page.evaluate(() => window.__debug.adelantarRelojTurno!(60000));
  const sigue = await page.evaluate(() => window.__debug.relojTurno!);
  expect(sigue.estado).toBe("pausado");
  expect(Math.abs(sigue.restanteMs - pausado.restanteMs)).toBeLessThanOrEqual(100);
  expect(await page.evaluate(() => window.__debug.ultimoDisparo ?? null)).toEqual(disparoAntes);
  await page.screenshot({ path: "capturas/reloj-ajustes-avisos-2-panel-pausa-360x640.png" });

  await page.getByTestId("cerrar-ajustes").click();
  await page.waitForFunction(() => window.__debug.relojTurno!.estado === "corriendo");
  await page.waitForTimeout(2000);
  const despues = await page.evaluate(() => window.__debug.relojTurno!);
  expect(despues.restanteMs).toBeLessThan(pausado.restanteMs - 1500);
  expect(despues.restanteMs).toBeGreaterThan(pausado.restanteMs - 3500);
});

test("rel-3: abrir ⚙ en el turno de la IA no toca el reloj, que sigue parado, y el turno vuelve al humano", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, { width: 360, height: 640 }, 30);
  const turnoHumano = await page.evaluate(() => window.__debug.turno!);
  const numeroTurno = await page.evaluate(() => window.__debug.numeroTurno!);
  await page.evaluate(() => window.__debug.fijarApuntado!(40, 60));
  await page.getByTestId("disparar").click();
  await page.waitForFunction((h) => window.__debug.turno !== h, turnoHumano, { timeout: 60000 });
  await page.getByTestId("boton-ajustes").click();
  expect(await page.evaluate(() => window.__debug.relojTurno!.estado)).toBe("parado");
  await expect(page.getByTestId("reloj-en-pausa")).toHaveCount(0);
  await page.getByTestId("cerrar-ajustes").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n + 1, numeroTurno, { timeout: 90000 });
  await page.waitForFunction(() => window.__debug.relojTurno!.estado === "corriendo", undefined, { timeout: 30000 });
});

test("rel-4: el aviso de tiempo dura al menos 3 s y se va tras el aterrizaje", async ({ page }) => {
  test.setTimeout(120000);
  mkdirSync("capturas", { recursive: true });
  await empezar(page, { width: 360, height: 640 }, 30);
  await page.evaluate(() => window.__debug.fijarApuntado!(40, 60));
  // Cronometra en la página cuándo aparece y cuándo desaparece el aviso.
  await page.evaluate(() => {
    const w = window as unknown as { __avisoMs?: { ini: number | null; fin: number | null } };
    w.__avisoMs = { ini: null, fin: null };
    const mira = (): void => {
      const visible = document.querySelector('[data-testid="aviso-tiempo-agotado"]') !== null;
      if (visible && w.__avisoMs!.ini === null) w.__avisoMs!.ini = performance.now();
      if (!visible && w.__avisoMs!.ini !== null && w.__avisoMs!.fin === null) w.__avisoMs!.fin = performance.now();
      requestAnimationFrame(mira);
    };
    mira();
  });
  await page.evaluate(() => window.__debug.adelantarRelojTurno!(30000));
  const aviso = page.getByTestId("aviso-tiempo-agotado");
  await expect(aviso).toContainText("¡Tiempo! Disparo automático");
  await page.screenshot({ path: "capturas/reloj-ajustes-avisos-3-aviso-tiempo-360x640.png" });
  await page.waitForFunction(() => (window as unknown as { __avisoMs: { fin: number | null } }).__avisoMs.fin !== null, undefined, { timeout: 30000 });
  const { ini, fin } = await page.evaluate(() => (window as unknown as { __avisoMs: { ini: number; fin: number } }).__avisoMs);
  expect(fin - ini).toBeGreaterThanOrEqual(2950);
  expect(fin - ini).toBeLessThanOrEqual(10500);
});

for (const tam of [
  { width: 360, height: 640 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
] as const) {
  test(`rel-5: con «Texto grande» el aviso «Listo para jugar sin conexión» y el ⚙ no tapan la ayuda (${tam.width}x${tam.height})`, async ({ page }) => {
    test.setTimeout(120000);
    mkdirSync("capturas", { recursive: true });
    await page.setViewportSize(tam);
    await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
    await page.getByTestId("humanos-1").click();
    await page.getByTestId("ias-1").click();
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.mundo !== undefined);
    await page.getByTestId("boton-ajustes").click();
    await page.getByTestId("toggle-texto-grande").click();
    await page.getByTestId("cerrar-ajustes").click();
    await page.evaluate(() => window.__debug.mostrarAvisoPwa!("listo"));
    await expect(page.getByTestId("aviso-listo-sin-conexion")).toBeVisible();
    await expect(page.getByTestId("ayuda-inicial")).toBeVisible();
    const r = await page.evaluate(() => {
      const caja = (e: Element) => {
        const b = e.getBoundingClientRect();
        return { x: b.left, y: b.top, r: b.right, b: b.bottom };
      };
      const p = document.querySelector('[data-testid="ayuda-control-angulo"]')!;
      const rango = document.createRange();
      rango.selectNodeContents(p);
      const primera = rango.getClientRects()[0];
      return {
        aviso: caja(document.querySelector('[data-testid="aviso-listo-sin-conexion"]')!),
        ajustes: caja(document.querySelector('[data-testid="boton-ajustes"]')!),
        linea: { x: primera.left, y: primera.top, r: primera.right, b: primera.bottom },
      };
    });
    const solapan = (a: { x: number; y: number; r: number; b: number }, b: { x: number; y: number; r: number; b: number }) =>
      a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
    expect(solapan(r.aviso, r.linea)).toBe(false);
    expect(solapan(r.ajustes, r.linea)).toBe(false);
    expect(r.linea.y).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: `capturas/reloj-ajustes-avisos-4-texto-grande-${tam.width}x${tam.height}.png` });
  });
}
