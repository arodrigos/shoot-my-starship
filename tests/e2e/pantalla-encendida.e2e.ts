import { test, expect, type Page } from "@playwright/test";
import { instalarWakeLockFalso } from "../utils/wakeLockFalso";

// pantalla-encendida: todos los casos usan el doble de navigator.wakeLock,
// nunca el bloqueo real del navegador.
test.use({ viewport: { width: 360, height: 640 } });

const estado = (page: Page) => page.evaluate(() => window.__debug.pantallaEncendida!());
const falso = (page: Page) =>
  page.evaluate(() => ({ peticiones: window.__wakeLockFalso!.peticiones, vivos: window.__wakeLockFalso!.vivos, tipos: window.__wakeLockFalso!.tipos }));

async function empezar(page: Page) {
  await page.goto("/?semilla=7&modo=barra-libre");
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  await page.waitForFunction(() => window.__debug?.pantallaEncendida !== undefined);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.forzarFinDePartida !== undefined);
}

async function finDePartida(page: Page) {
  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible({ timeout: 60000 });
}

test("pe-1: en la portada no se pide; al pulsar «Jugar» se pide un bloqueo 'screen' y sigue activo sin tocar nada", async ({ page }) => {
  test.setTimeout(120000);
  await instalarWakeLockFalso(page, "conceder");
  await page.goto("/?semilla=7&modo=barra-libre");
  await page.waitForFunction(() => window.__debug?.pantallaEncendida !== undefined);
  expect(await falso(page)).toMatchObject({ peticiones: 0, vivos: 0 });
  expect((await estado(page)).estado).toBe("inactivo");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForTimeout(3000);
  expect(await falso(page)).toMatchObject({ peticiones: 1, vivos: 1, tipos: ["screen"] });
  expect(await estado(page)).toMatchObject({ estado: "activo", deseada: true, sentinelasVivas: 1 });
});

test("pe-2: el parte suelta el bloqueo y «Otra partida» lo vuelve a pedir, sin pasar nunca de uno vivo", async ({ page }) => {
  test.setTimeout(240000);
  await instalarWakeLockFalso(page, "conceder");
  await empezar(page);
  await page.waitForFunction(() => window.__debug.pantallaEncendida!().estado === "activo");
  await page.evaluate(() => {
    const w = window as unknown as { __maxVivos: number };
    w.__maxVivos = 0;
    const muestrear = () => {
      w.__maxVivos = Math.max(w.__maxVivos, window.__wakeLockFalso!.vivos);
      requestAnimationFrame(muestrear);
    };
    muestrear();
  });
  for (let ciclo = 0; ciclo < 3; ciclo++) {
    await finDePartida(page);
    await expect.poll(() => estado(page).then((e) => e.estado)).toBe("soltado");
    expect(await falso(page)).toMatchObject({ vivos: 0 });
    await page.getByTestId("otra-partida").click();
    await expect.poll(() => estado(page).then((e) => e.estado)).toBe("activo");
    expect((await falso(page)).vivos).toBe(1);
    await page.waitForFunction(() => window.__debug.forzarFinDePartida !== undefined && window.__debug.naves !== undefined);
  }
  expect((await falso(page)).peticiones).toBe(4);
  expect(await page.evaluate(() => (window as unknown as { __maxVivos: number }).__maxVivos)).toBeLessThanOrEqual(1);
});

test("pe-3: al ocultar y mostrar la página con partida se vuelve a pedir; con el parte visible no", async ({ page }) => {
  test.setTimeout(180000);
  await instalarWakeLockFalso(page, "conceder");
  await empezar(page);
  await page.waitForFunction(() => window.__debug.pantallaEncendida!().estado === "activo");
  await page.evaluate(() => window.__wakeLockFalso!.ocultarPagina());
  await expect.poll(() => falso(page).then((f) => f.vivos)).toBe(0);
  await page.evaluate(() => window.__wakeLockFalso!.mostrarPagina());
  await expect.poll(() => estado(page).then((e) => e.estado)).toBe("activo");
  expect(await falso(page)).toMatchObject({ peticiones: 2, vivos: 1 });

  await finDePartida(page);
  await page.evaluate(() => window.__wakeLockFalso!.ocultarPagina());
  await page.evaluate(() => window.__wakeLockFalso!.mostrarPagina());
  expect(await falso(page)).toMatchObject({ peticiones: 2, vivos: 0 });
  expect((await estado(page)).estado).toBe("soltado");
});

test("pe-4: tras soltarlo el sistema, el siguiente toque lo recupera; rechazado, los reintentos topan en 3", async ({ page }) => {
  test.setTimeout(180000);
  await instalarWakeLockFalso(page, "conceder");
  await empezar(page);
  await page.waitForFunction(() => window.__debug.pantallaEncendida!().estado === "activo");
  await page.evaluate(() => window.__wakeLockFalso!.soltarDesdeSistema());
  await expect.poll(() => estado(page).then((e) => e.estado)).toBe("soltado");
  await page.mouse.click(180, 300);
  await expect.poll(() => estado(page).then((e) => e.estado)).toBe("activo");
  expect((await falso(page)).peticiones).toBe(2);

  await page.evaluate(() => {
    window.__wakeLockFalso!.fijarModo("rechazar");
    window.__wakeLockFalso!.soltarDesdeSistema();
  });
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(180, 300);
    await page.waitForTimeout(150);
  }
  expect(await estado(page)).toMatchObject({ estado: "rechazado", rechazosSeguidos: 3 });
  expect((await falso(page)).peticiones).toBe(5);
});

for (const modo of ["sin-api", "rechazar"] as const) {
  test(`pe-5: con el doble en '${modo}' la partida llega al parte sin errores ni texto nuevo`, async ({ page }) => {
    test.setTimeout(180000);
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(m.text());
    });
    await instalarWakeLockFalso(page, modo);
    await empezar(page);
    await page.mouse.click(180, 300);
    const esperado = modo === "sin-api" ? "no-soportado" : "rechazado";
    await expect.poll(() => estado(page).then((e) => e.estado)).toBe(esperado);
    expect((await estado(page)).soportada).toBe(modo !== "sin-api");
    await finDePartida(page);
    await page.getByTestId("otra-partida").click();
    await page.waitForSelector("#game-container canvas");
    const cuerpo = (await page.locator("body").innerText()).toLowerCase();
    expect(cuerpo).not.toContain("bloqueo");
    expect(cuerpo).not.toContain("pantalla encendida");
    expect(errores.filter((e) => !/favicon|WebGL|GPU/i.test(e))).toEqual([]);
  });
}
