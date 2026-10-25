import { test, expect, type Page } from "@playwright/test";

// zonas-hud-camara: la cámara saca de debajo del HUD lo que importa (#314).
// Todo se lee de __debug.zonasCamara() (px CSS) y se espera con polling sobre
// el estado real, nunca con pausas fijas.
type Tamano = { ancho: number; alto: number };
const MOVIL: Tamano = { ancho: 360, alto: 640 };
const TABLETA: Tamano = { ancho: 820, alto: 1180 };
const HORIZONTAL: Tamano = { ancho: 1180, alto: 820 };

test.beforeEach(async ({}, testInfo) => {
  testInfo.setTimeout(240_000);
});

async function preparar(page: Page, tamano: Tamano, query = ""): Promise<void> {
  await page.setViewportSize({ width: tamano.ancho, height: tamano.alto });
  await page.goto(`/${query}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined && window.__debug.zonasCamara !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

async function cargar(page: Page, f0: { fx: number; fy: number }, f1: { fx: number; fy: number }): Promise<void> {
  await page.evaluate(
    ({ a, b }) => {
      const m = window.__debug.mundo!;
      window.__debug.cargarEscenario!({
        naves: [
          { x: m.ancho * a.fx, y: m.alto * a.fy, integridad: 150 },
          { x: m.ancho * b.fx, y: m.alto * b.fy, integridad: 150 },
        ],
        arma: "pepinazo-cortesia",
        anguloGrados: 45,
        potencia: 50,
      });
    },
    { a: f0, b: f1 },
  );
  await page.waitForFunction(() => window.__debug.control!.ajuste.potencia === 50 && window.__debug.control!.puedeDisparar === true);
  await esperarValido(page);
}

const TAPADA = { f0: { fx: 0.3, fy: 0.2 }, f1: { fx: 0.7, fy: 0.9 } };

async function esperarValido(page: Page): Promise<void> {
  // Con el WebGL por software la transición de 300 ms tarda varios segundos de
  // reloj (el delta de Phaser va acotado), así que se espera a que el encuadre
  // sea válido y no cambie entre dos lecturas separadas.
  await page.waitForFunction(() => window.__debug.zonasCamara!().valido === true, undefined, { timeout: 40000 });
  let previa = "";
  await expect
    .poll(
      async () => {
        const c = await page.evaluate(() => JSON.stringify(window.__debug.camara));
        const quieta = c === previa;
        previa = c;
        return quieta;
      },
      { timeout: 40000, intervals: [900] },
    )
    .toBe(true);
}

async function rectConsola(page: Page) {
  return page.evaluate(() => document.querySelector('[data-testid="consola"]')!.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number; top: number; bottom: number; left: number; right: number });
}

async function navesFueraDeLaConsola(page: Page, tamano: Tamano): Promise<void> {
  const z = await page.evaluate(() => window.__debug.zonasCamara!());
  const c = await rectConsola(page);
  const naves = z.objetivos.filter((o) => o.tipo === "nave");
  expect(naves).toHaveLength(2);
  for (const n of naves) {
    expect(n.css.x).toBeGreaterThanOrEqual(-1);
    expect(n.css.y).toBeGreaterThanOrEqual(-1);
    expect(n.css.x + n.css.ancho).toBeLessThanOrEqual(tamano.ancho + 1);
    expect(n.css.y + n.css.alto).toBeLessThanOrEqual(tamano.alto + 1);
    const solapa = n.css.x < c.right && n.css.x + n.css.ancho > c.left && n.css.y < c.bottom && n.css.y + n.css.alto > c.top;
    expect(solapa, `nave bajo la consola ${JSON.stringify(n.css)} vs ${JSON.stringify(c)}`).toBe(false);
  }
  expect(z.valido).toBe(true);
}

test("zc-1: la nave rival tapada por la consola se saca a la parte libre (anclajes y mínima)", async ({ page }) => {
  await preparar(page, MOVIL);
  await cargar(page, TAPADA.f0, TAPADA.f1);
  for (let i = 0; i < 3; i++) {
    await navesFueraDeLaConsola(page, MOVIL);
    const z = await page.evaluate(() => window.__debug.zonasCamara!());
    expect(z.zoom).toBeLessThanOrEqual(1);
    expect(["turno", "usuario", "inicial"]).toContain(z.motivo);
    await page.screenshot({ path: `test-results/zonas-camara/zc-1-anclaje-${i}.png` });
    await page.getByTestId("boton-mover-consola").click();
    await esperarValido(page);
  }
  await page.getByTestId("boton-plegar-consola").click();
  await expect(page.getByTestId("barra-minima")).toBeVisible();
  await esperarValido(page);
  await navesFueraDeLaConsola(page, MOVIL);
});

test("zc-1: nave en la esquina inferior derecha del mundo", async ({ page }) => {
  await preparar(page, MOVIL);
  await cargar(page, TAPADA.f0, { fx: 0.98, fy: 0.98 });
  await navesFueraDeLaConsola(page, MOVIL);
});

test("zc-2 y zc-3: al disparar las naves no se mueven y el proyectil se ve todo el vuelo", async ({ page }) => {
  await preparar(page, MOVIL);
  await cargar(page, TAPADA.f0, TAPADA.f1);
  const antes = await page.evaluate(() => window.__debug.zonasCamara!());
  await page.evaluate(() => {
    const w = window as unknown as { __muestras: { x: number; y: number }[] };
    w.__muestras = [];
    const m = window.__debug.mundo!;
    const bucle = () => {
      const p = window.__debug.proyectilEnVuelo;
      const z = window.__debug.zonasCamara!();
      const c = window.__debug.camara!;
      if (p) {
        // Mundo a CSS con el rectángulo de cámara y la caja del lienzo.
        const l = document.querySelector("#game-container canvas")!.getBoundingClientRect();
        w.__muestras.push({ x: l.x + ((p.x - c.x) / c.ancho) * l.width, y: l.y + ((p.y - c.y) / c.alto) * l.height });
      }
      void z;
      void m;
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
  });
  await page.getByTestId("disparar").click();
  const despues = await page.evaluate(() => window.__debug.zonasCamara!());
  const navesA = antes.objetivos.filter((o) => o.tipo === "nave");
  const navesD = despues.objetivos.filter((o) => o.tipo === "nave");
  // zc-3: el reencuadre por apartarse la consola no mueve las naves.
  navesA.forEach((n, i) => {
    expect(Math.abs(navesD[i].css.x - n.css.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(navesD[i].css.y - n.css.y)).toBeLessThanOrEqual(1);
  });
  expect(despues.reencuadres).toBe(antes.reencuadres);
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false && window.__debug.ultimoDisparo !== undefined, undefined, { timeout: 90000 });
  const muestras = await page.evaluate(() => (window as unknown as { __muestras: { x: number; y: number }[] }).__muestras);
  expect(muestras.length).toBeGreaterThan(0);
  const fuera = muestras.filter((m) => m.x < -2 || m.y < -2 || m.x > MOVIL.ancho + 2 || m.y > MOVIL.alto + 2);
  expect(fuera).toEqual([]);
});

test("zc-4 y zc-9: plegar, ocultar y mostrar reencuadran con latencia y el recuadro la enseña", async ({ page }) => {
  await preparar(page, MOVIL, "?rendimiento=1");
  await cargar(page, TAPADA.f0, TAPADA.f1);
  expect((await page.evaluate(() => window.__debug.zonasCamara!())).zoom).toBeLessThanOrEqual(1);
  await page.getByTestId("boton-plegar-consola").click();
  await esperarValido(page);
  const lat = await page.evaluate(() => window.__debug.latencias!().filter((l) => l.nombre === "reencuadre").map((l) => l.ms));
  expect(lat.length).toBeGreaterThan(0);
  expect(lat[lat.length - 1]).toBeLessThanOrEqual(200);
  await expect(page.getByTestId("hud-rendimiento-texto")).toContainText(/reencuadre:\s*\d+/, { timeout: 600 });
  await page.screenshot({ path: "test-results/zonas-camara/zc-9-recuadro.png" });
  await page.getByTestId("boton-ocultar-consola").click();
  await esperarValido(page);
  await page.getByTestId("pestana-consola").click();
  await esperarValido(page);
});

test("zc-4: con movimiento reducido el encuadre final se aplica de golpe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparar(page, MOVIL);
  await cargar(page, TAPADA.f0, TAPADA.f1);
  await page.getByTestId("boton-plegar-consola").click();
  await page.waitForFunction(() => window.__debug.zonasCamara!().valido === true, undefined, { timeout: 40000 });
});

for (const t of [MOVIL, TABLETA, HORIZONTAL]) {
  test(`zc-5: sin nada tapado la vista es la de hoy a ${t.ancho}x${t.alto}`, async ({ page }) => {
    await preparar(page, t);
    await cargar(page, { fx: 0.3, fy: 0.25 }, { fx: 0.7, fy: 0.3 });
    const m = await page.evaluate(() => window.__debug.mundo!);
    const c = await page.evaluate(() => window.__debug.camara!);
    expect(c).toMatchObject({ x: 0, y: 0, ancho: m.ancho, alto: m.alto, zoom: 1, modo: "auto" });
    const base = (await page.evaluate(() => window.__debug.zonasCamara!())).reencuadres;
    await page.getByTestId("boton-plegar-consola").click();
    await esperarValido(page);
    expect((await page.evaluate(() => window.__debug.zonasCamara!())).reencuadres).toBe(base);
    await page.screenshot({ path: `test-results/zonas-camara/zc-5-${t.ancho}x${t.alto}.png` });
  });
}

test("zc-6: en manual plegar no mueve la cámara y «Ver todo» vuelve a auto", async ({ page }) => {
  await preparar(page, MOVIL);
  await cargar(page, TAPADA.f0, TAPADA.f1);
  const caja = (await page.locator("#game-container canvas").boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 3);
  await page.mouse.wheel(0, -400);
  await page.waitForFunction(() => window.__debug.camara!.modo === "manual", undefined, { timeout: 5000 });
  const antes = await page.evaluate(() => JSON.stringify(window.__debug.camara));
  await page.getByTestId("boton-plegar-consola").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="barra-minima"]') !== null);
  expect(await page.evaluate(() => JSON.stringify(window.__debug.camara))).toBe(antes);
  await page.getByTestId("ver-todo").click();
  await esperarValido(page);
  expect((await page.evaluate(() => window.__debug.camara!)).modo).toBe("auto");
  const lat = await page.evaluate(() => window.__debug.latencias!().filter((l) => l.nombre === "ver-todo").map((l) => l.ms));
  expect(lat[lat.length - 1]).toBeLessThanOrEqual(200);
});

test("zc-7: girar el dispositivo y «Texto grande» mantienen las naves fuera del HUD", async ({ page }) => {
  await preparar(page, TABLETA);
  await cargar(page, TAPADA.f0, TAPADA.f1);
  await page.setViewportSize({ width: HORIZONTAL.ancho, height: HORIZONTAL.alto });
  await esperarValido(page);
  await navesFueraDeLaConsola(page, HORIZONTAL);
  await page.setViewportSize({ width: MOVIL.ancho, height: MOVIL.alto });
  await esperarValido(page);
  await page.getByTestId("boton-ajustes").click();
  await page.getByTestId("toggle-texto-grande").click();
  await page.getByTestId("cerrar-ajustes").click();
  await esperarValido(page);
  await navesFueraDeLaConsola(page, MOVIL);
});

test("zc-7: el recuadro de ?rendimiento=1 es una zona más", async ({ page }) => {
  await preparar(page, MOVIL, "?rendimiento=1");
  await cargar(page, { fx: 0.25, fy: 0.1 }, { fx: 0.38, fy: 0.17 });
  const z = await page.evaluate(() => window.__debug.zonasCamara!());
  expect(z.zonas.some((q) => q.id === "rendimiento")).toBe(true);
  const r = await page.evaluate(() => document.querySelector('[data-testid="hud-rendimiento"]')!.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number });
  const n = z.objetivos.find((o) => o.tipo === "nave")!;
  const solapa = n.css.x < r.right && n.css.x + n.css.ancho > r.left && n.css.y < r.bottom && n.css.y + n.css.alto > r.top;
  expect(solapa).toBe(false);
  expect(z.valido).toBe(true);
});

test("zc-8: el fondo no se rehornea tras varios reencuadres", async ({ page }) => {
  await preparar(page, MOVIL);
  await cargar(page, TAPADA.f0, TAPADA.f1);
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("boton-mover-consola").click();
    await esperarValido(page);
  }
  await page.getByTestId("boton-plegar-consola").click();
  await esperarValido(page);
  await page.getByTestId("boton-ocultar-consola").click();
  await esperarValido(page);
  await page.getByTestId("pestana-consola").click();
  await esperarValido(page);
  expect(await page.evaluate(() => window.__debug.fondoEspacial?.bakes)).toBe(1);
  await page.screenshot({ path: "test-results/zonas-camara/zc-8-fuera-del-mundo.png" });
});

test("zc-inv: zonasCamara es de solo lectura", async ({ page }) => {
  await preparar(page, MOVIL);
  await cargar(page, TAPADA.f0, TAPADA.f1);
  const igual = await page.evaluate(() => {
    const a = window.__debug.zonasCamara!();
    const antes = JSON.stringify(window.__debug.zonasCamara!());
    (a as { zoom: number }).zoom = 99;
    (a.objetivos as unknown[]).length = 0;
    return JSON.stringify(window.__debug.zonasCamara!()) === antes;
  });
  expect(igual).toBe(true);
});
