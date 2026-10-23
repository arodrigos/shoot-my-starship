import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { palabrasPartidas } from "../utils/palabrasPartidas";

// P2 (texto-grande): tg-1 a tg-4. Mapa sembrado de siempre.
const MAPA_SEMBRADO = "calma-de-los-restos";
const TAMANOS = [
  { width: 360, height: 640 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
] as const;

async function empezar(page: Page, tam: { width: number; height: number }, previo?: () => Promise<void>): Promise<void> {
  await page.setViewportSize(tam);
  if (previo) await previo();
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("humanos-1").click();
  await page.getByTestId("ias-3").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

test("tg-1: el interruptor agranda el HUD un 30 % al momento, sin remontar nada", async ({ page }) => {
  test.setTimeout(180000);
  mkdirSync("capturas", { recursive: true });
  await empezar(page, TAMANOS[0]);
  await page.getByTestId("boton-ajustes").click();
  const boton = page.getByTestId("toggle-texto-grande");
  await expect(boton).toHaveAttribute("aria-pressed", "false");
  await expect(boton).toHaveText("Texto grande: No");
  const idAyuda = await boton.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${idAyuda}"]`)).toHaveText("Agranda los textos del juego para leerlos de lejos");
  const ayudaAntes = await page.locator(`[id="${idAyuda}"]`).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const contadores = () => page.evaluate(() => ({ r: window.__debug.contadorResize, b: window.__debug.fondoEspacial?.bakes }));
  const c0 = await contadores();
  await page.screenshot({ path: "capturas/texto-grande-1-antes-360x640.png" });

  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolver) => {
        const t0 = performance.now();
        (document.querySelector('[data-testid="toggle-texto-grande"]') as HTMLElement).click();
        requestAnimationFrame(() => requestAnimationFrame(() => resolver(performance.now() - t0)));
      }),
  );
  expect(ms).toBeLessThanOrEqual(200);
  await expect(boton).toHaveAttribute("aria-pressed", "true");
  await expect(boton).toHaveText("Texto grande: Sí");
  expect(await page.evaluate(() => document.documentElement.dataset.textoGrande)).toBe("1");
  const ayudaDespues = await page.locator(`[id="${idAyuda}"]`).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(Math.abs(ayudaDespues - ayudaAntes * 1.3)).toBeLessThanOrEqual(0.5);
  expect(await contadores()).toEqual(c0);
  await page.screenshot({ path: "capturas/texto-grande-1-despues-360x640.png" });

  await boton.click();
  const ayudaFinal = await page.locator(`[id="${idAyuda}"]`).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(ayudaFinal).toBeCloseTo(ayudaAntes, 1);
  expect(await page.evaluate(() => document.documentElement.dataset.textoGrande)).toBeUndefined();
});

test("tg-2: se recuerda entre visitas y sale grande desde el primer fotograma; la portada no cambia", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize(TAMANOS[0]);
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  const portadaBase = await page.evaluate(() => document.body.scrollHeight);
  await page.evaluate(() => localStorage.setItem("legibilidad:texto-grande", "1"));
  await page.addInitScript(() => {
    const w = window as unknown as { __primerTam?: number };
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="boton-ajustes"]');
      if (el && w.__primerTam === undefined) w.__primerTam = parseFloat(getComputedStyle(el).fontSize);
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await expect(page.getByTestId("boton-jugar")).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollHeight)).toBe(portadaBase);
  await page.getByTestId("humanos-1").click();
  await page.getByTestId("ias-3").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector('[data-testid="boton-ajustes"]');
  const base = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="boton-ajustes"]')!;
    return parseFloat(getComputedStyle(el).fontSize);
  });
  const primero = await page.evaluate(() => (window as unknown as { __primerTam?: number }).__primerTam);
  expect(primero).toBeDefined();
  expect(primero).toBeCloseTo(base, 1);
  expect(await page.evaluate(() => localStorage.getItem("legibilidad:texto-grande"))).toBe("1");
  expect(await page.evaluate(() => document.documentElement.dataset.textoGrande)).toBe("1");
});

test("tg-2: un valor corrupto lo deja apagado sin errores", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await empezar(page, TAMANOS[0], async () => {
    await page.addInitScript(() => localStorage.setItem("legibilidad:texto-grande", "basura"));
  });
  expect(await page.evaluate(() => document.documentElement.dataset.textoGrande)).toBeUndefined();
  expect(errores).toEqual([]);
});

for (const tam of TAMANOS) {
  test(`tg-3/tg-4: parte de 4 asientos y menú sin solapes con texto grande a ${tam.width}x${tam.height}`, async ({ page }) => {
    test.setTimeout(240000);
    mkdirSync("capturas", { recursive: true });
    await empezar(page, tam, async () => {
      await page.addInitScript(() => localStorage.setItem("legibilidad:texto-grande", "1"));
    });
    // Menú ⚙ desplazable: ningún texto cortado.
    await page.getByTestId("boton-ajustes").click();
    await page.screenshot({ path: `capturas/texto-grande-3-menu-${tam.width}x${tam.height}.png` });
    const cortados = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid^="toggle-"], [data-testid^="toggle-"] + p')).filter(
        (e) => e.scrollWidth > e.clientWidth + 1,
      ).length,
    );
    expect(cortados).toBe(0);
    await page.getByTestId("boton-ajustes").click();

    await page.waitForFunction(() => window.__debug.forzarFinDePartida !== undefined);
    await page.evaluate(() => window.__debug.forzarFinDePartida!());
    await page.waitForFunction(() => window.__debug.parteDeGuerra != null, undefined, { timeout: 60000 });
    await page.getByTestId("ver-numeros").click();
    const medir = () =>
      page.evaluate(() => {
        const caja = (el: Element) => el.getBoundingClientRect();
        const tarjetas = Array.from(document.querySelectorAll('[data-testid^="premio-asiento-"]'))
          .filter((e) => /^premio-asiento-\d+$/.test(e.getAttribute("data-testid") ?? ""))
          .map(caja);
        const b = caja(document.querySelector('[data-testid="otra-partida"]')!);
        const cruza = (a: DOMRect, c: DOMRect) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
        let intersecciones = 0;
        tarjetas.forEach((a, i) => {
          if (cruza(a, b)) intersecciones++;
          tarjetas.slice(i + 1).forEach((c) => cruza(a, c) && intersecciones++);
        });
        const desbordes = Array.from(document.querySelectorAll('[data-testid="parte-de-guerra"] *')).filter(
          (e) => e.scrollWidth > e.clientWidth + 1,
        ).length;
        const panel = document.querySelector('[data-testid="parte-de-guerra"] > div')!;
        return { n: tarjetas.length, intersecciones, desbordes: desbordes + (panel.scrollWidth > panel.clientWidth ? 1 : 0), botonDentro: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth };
      });
    const arriba = await medir();
    expect(arriba.n).toBe(4);
    expect(arriba).toMatchObject({ intersecciones: 0, desbordes: 0, botonDentro: true });
    expect(await palabrasPartidas(page, '[data-testid="parte-de-guerra"]'), "palabras partidas a mitad").toEqual([]);
    await page.screenshot({ path: `capturas/texto-grande-3-parte-arriba-${tam.width}x${tam.height}.png` });
    await page.getByTestId("parte-de-guerra").evaluate((el) => {
      for (const e of [el, ...Array.from(el.querySelectorAll("*"))]) if (e.scrollHeight > e.clientHeight) e.scrollTop = e.scrollHeight;
    });
    const abajo = await medir();
    expect(abajo).toMatchObject({ intersecciones: 0, desbordes: 0, botonDentro: true });
    await page.screenshot({ path: `capturas/texto-grande-3-parte-abajo-${tam.width}x${tam.height}.png` });
  });
}

// tg-3: dos avisos a la vez (las ayudas de apuntado y de cámara, que salen
// juntas en un navegador nuevo) con texto grande. «¡Tiempo!» no coincide con
// ellas: al agotarse el reloj el disparo automático las oculta.
test("tg-3: dos avisos a la vez no se pisan entre sí ni con el botón ⚙ a 360x640", async ({ page }) => {
  test.setTimeout(240000);
  mkdirSync("capturas", { recursive: true });
  await page.addInitScript(() => localStorage.setItem("legibilidad:texto-grande", "1"));
  await page.setViewportSize(TAMANOS[0]);
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await expect(page.getByTestId("ayuda-apuntado")).toBeVisible();
  await expect(page.getByTestId("ayuda-camara")).toBeVisible();
  const m = await page.evaluate(() => {
    const caja = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
    const cruza = (a: DOMRect, c: DOMRect) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
    const ayuda = caja("ayuda-apuntado");
    const tiempo = caja("ayuda-camara");
    const ajustes = caja("boton-ajustes");
    const textos = Array.from(document.querySelectorAll('[data-testid="capa-avisos"] *')).filter((e) => e.scrollWidth > e.clientWidth + 1).length;
    return {
      entreSi: cruza(ayuda, tiempo),
      ayudaConAjustes: cruza(ayuda, ajustes),
      tiempoConAjustes: cruza(tiempo, ajustes),
      textosCortados: textos,
      dentro: ayuda.left >= 0 && tiempo.right <= innerWidth,
      fontSize: parseFloat(getComputedStyle(document.querySelector('[data-testid="ayuda-camara"]')!).fontSize),
    };
  });
  expect(m).toMatchObject({ entreSi: false, ayudaConAjustes: false, tiempoConAjustes: false, textosCortados: 0, dentro: true });
  expect(m.fontSize).toBeGreaterThanOrEqual(18);
  expect(await palabrasPartidas(page, '[data-testid="capa-avisos"]'), "palabras partidas a mitad").toEqual([]);
  await page.screenshot({ path: "capturas/texto-grande-3-dos-avisos-360x640.png" });
});

test("tg-4: la portada mide igual con y sin el ajuste", async ({ page }) => {
  await page.setViewportSize(TAMANOS[0]);
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await expect(page.getByTestId("boton-jugar")).toBeVisible();
  const medir = () =>
    page.evaluate(() => Array.from(document.querySelectorAll("button, h1, h2, p")).map((e) => JSON.stringify(e.getBoundingClientRect())));
  const sin = await medir();
  await page.evaluate(() => (document.documentElement.dataset.textoGrande = "1"));
  expect(await medir()).toEqual(sin);
  mkdirSync("capturas", { recursive: true });
  await page.screenshot({ path: "capturas/texto-grande-4-portada-con-ajuste-360x640.png" });
});

// tg-3 (consola): 1 humano, 3 IA y reloj de 30 s. Sin filtrar por overflow-x: con
// overflow:hidden y elipsis, scrollWidth > clientWidth es justo el nombre cortado.
for (const tam of TAMANOS) {
  for (const grande of [true, false]) {
    test(`tg-3 consola: pestañas de vida sin cortes y píldora fuera del nombre (${tam.width}x${tam.height}, ${grande ? "grande" : "normal"})`, async ({ page }) => {
      test.setTimeout(180000);
      mkdirSync("capturas", { recursive: true });
      await page.setViewportSize(tam);
      if (grande) await page.addInitScript(() => localStorage.setItem("legibilidad:texto-grande", "1"));
      await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
      await page.getByTestId("humanos-1").click();
      await page.getByTestId("ias-3").click();
      await page.getByTestId("reloj-30").click();
      await page.getByTestId("boton-jugar").click();
      await page.waitForSelector("#game-container canvas");
      await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined);
      if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
      await expect(page.getByTestId("reloj-turno")).toBeVisible();
      await expect(page.getByTestId("ayuda-apuntado")).toBeVisible();

      const m = await page.evaluate(() => {
        const cortados = Array.from(document.querySelectorAll('[data-testid^="integridad-etiqueta-"], [data-testid^="integridad-nivel-"]'))
          .filter((e) => e.scrollWidth > e.clientWidth)
          .map((e) => e.getAttribute("data-testid"));
        const reloj = document.querySelector('[data-testid="reloj-turno"]')!.getBoundingClientRect();
        const cruza = (a: DOMRect, c: DOMRect) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
        const etiquetas = Array.from(document.querySelectorAll('[data-testid^="integridad-etiqueta-"]')).map((e) => e.getBoundingClientRect());
        const cerrar = parseFloat(getComputedStyle(document.querySelector('[data-testid="ayuda-apuntado-cerrar"]')!).fontSize);
        return { cortados, cruzaReloj: etiquetas.filter((e) => cruza(reloj, e)).length, cerrar };
      });
      expect(m.cortados, "pestañas con el texto cortado").toEqual([]);
      expect(m.cruzaReloj).toBe(0);
      expect(m.cerrar).toBeGreaterThanOrEqual(grande ? 18 : 14);
      expect(await palabrasPartidas(page, '[data-testid="consola"]'), "palabras partidas a mitad").toEqual([]);
      await page.screenshot({ path: `capturas/texto-grande-3-consola-${grande ? "grande" : "normal"}-${tam.width}x${tam.height}.png` });
    });
  }
}
