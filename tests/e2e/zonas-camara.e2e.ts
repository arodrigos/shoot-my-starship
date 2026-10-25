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
  // La config de Playwright apaga los eventos en bloque, y con ellos el aviso
  // «Próximo evento…» que en el preview sale desde el primer turno: sin él el
  // spec nunca vio lo que tapa la nave bajo la consola.
  await page.evaluate(() => window.localStorage.setItem("universo:eventos", "1"));
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined && window.__debug.zonasCamara !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await expect(page.getByTestId("pronostico")).toBeVisible({ timeout: 30000 });
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

// Lo que la consola pinta: su caja, la fila ⇄ ▾ ✕ y los avisos que cuelgan de
// ella («Próximo evento…», vuelo corto, muerte súbita). Se mide del DOM por
// separado del código (que usa data-zona-extra) para que el oráculo no repita la
// lista de excepciones de la implementación: todo descendiente visible de
// tamaño no nulo de la consola cuenta.
async function rectConsola(page: Page) {
  return page.evaluate(() => {
    const raiz = document.querySelector('[data-testid="consola"]')!;
    const visibles = [raiz, ...raiz.querySelectorAll('[data-testid="fila-botones-consola"], [data-testid="fila-avisos"], [data-testid="pronostico"], [data-testid="aviso-vuelo-corto"], [data-testid="muerte-subita"]')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const left = Math.min(...visibles.map((r) => r.left));
    const top = Math.min(...visibles.map((r) => r.top));
    const right = Math.max(...visibles.map((r) => r.right));
    const bottom = Math.max(...visibles.map((r) => r.bottom));
    return { x: left, y: top, width: right - left, height: bottom - top, top, bottom, left, right };
  });
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

test("zc-3: al disparar la cámara no se mueve mientras el proyectil no se sale de la vista", async ({ page }) => {
  await preparar(page, MOVIL);
  await cargar(page, TAPADA.f0, TAPADA.f1);
  // Tiro corto: el proyectil se queda cerca de su nave y no obliga a seguirlo.
  await page.evaluate(() => window.__debug.fijarApuntado!(45, 12));
  const antes = await page.evaluate(() => ({ z: window.__debug.zonasCamara!(), camara: JSON.stringify(window.__debug.camara) }));
  await page.screenshot({ path: "test-results/zonas-camara/zc-3-antes.png" });
  await page.getByTestId("disparar").click();
  // La consola se aparta con el tiro: se espera a que lo haya hecho.
  await page.waitForFunction(() => window.__debug.zonasCamara!().zonas.find((q) => q.id === "consola")?.visible === false, undefined, { timeout: 20000 });
  const despues = await page.evaluate(() => ({ z: window.__debug.zonasCamara!(), camara: JSON.stringify(window.__debug.camara) }));
  const propia = (r: typeof antes) => r.z.objetivos.filter((o) => o.tipo === "nave")[0].css;
  expect(Math.abs(propia(despues).x - propia(antes).x)).toBeLessThanOrEqual(1);
  expect(Math.abs(propia(despues).y - propia(antes).y)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/zonas-camara/zc-3-despues.png" });
  expect(despues.camara).toBe(antes.camara);
  expect(despues.z.reencuadres).toBe(antes.z.reencuadres);
});

test("zc-2: el proyectil en vuelo y el impacto quedan dentro de la pantalla", async ({ page }) => {
  await preparar(page, MOVIL);
  await cargar(page, TAPADA.f0, TAPADA.f1);
  await page.evaluate(() => {
    const w = window as unknown as { __muestras: { x: number; y: number }[] };
    w.__muestras = [];
    const bucle = () => {
      const p = window.__debug.proyectilEnVuelo;
      if (p) {
        // Mundo a CSS con el rectángulo de la cámara y la caja del lienzo.
        const c = window.__debug.camara!;
        const l = document.querySelector("#game-container canvas")!.getBoundingClientRect();
        w.__muestras.push({ x: l.x + ((p.x - c.x) / c.ancho) * l.width, y: l.y + ((p.y - c.y) / c.alto) * l.height });
      }
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
  });
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.proyectilEnVuelo != null, undefined, { timeout: 30000 });
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 120000 });
  await page.screenshot({ path: "test-results/zonas-camara/zc-2-impacto.png" });
  const muestras = await page.evaluate(() => (window as unknown as { __muestras: { x: number; y: number }[] }).__muestras);
  expect(muestras.length).toBeGreaterThan(0);
  const margen = 40;
  const fuera = muestras.filter((m) => m.x < -margen || m.y < -margen || m.x > MOVIL.ancho + margen || m.y > MOVIL.alto + margen);
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
  await page.screenshot({ path: "test-results/zonas-camara/zc-6-ver-todo.png" });
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
  await page.screenshot({ path: "test-results/zonas-camara/zc-7-horizontal.png" });
  await page.setViewportSize({ width: MOVIL.ancho, height: MOVIL.alto });
  await esperarValido(page);
  await page.getByTestId("boton-ajustes").click();
  await page.getByTestId("toggle-texto-grande").click();
  await page.getByTestId("cerrar-ajustes").click();
  await esperarValido(page);
  await navesFueraDeLaConsola(page, MOVIL);
  await page.screenshot({ path: "test-results/zonas-camara/zc-7-texto-grande.png" });
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
