import { test, expect, type Page } from "@playwright/test";

// trayectoria-pantalla: la mira es una trayectoria corta medida en PANTALLA
// sobre el lado mayor L. Las capturas (CAPTURAS_DIR) son para el juicio visual.
type Tamano = { ancho: number; alto: number };
const MOVIL: Tamano = { ancho: 360, alto: 640 };
const TABLETA: Tamano = { ancho: 820, alto: 1180 };
const HORIZONTAL: Tamano = { ancho: 1180, alto: 820 };

async function preparar(page: Page, tamano: Tamano): Promise<void> {
  await page.setViewportSize({ width: tamano.ancho, height: tamano.alto });
  await page.goto("/?modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// La nave humana al centro, con espacio libre alrededor, y la rival lejos:
// cargarEscenario da el turno a la humana, de la que sale la mira.
async function cargar(page: Page, arma: string, anguloGrados: number, potencia: number): Promise<void> {
  await page.evaluate(
    ({ arma: a, ang, pot }) => {
      const mundo = window.__debug.mundo!;
      window.__debug.cargarEscenario!({
        naves: [
          { x: mundo.ancho * 0.5, y: mundo.alto * 0.5, integridad: 150 },
          { x: mundo.ancho * 0.2, y: mundo.alto * 0.2, integridad: 150 },
        ],
        arma: a,
        anguloGrados: ang,
        potencia: pot,
      });
    },
    { arma, ang: anguloGrados, pot: potencia },
  );
  await page.waitForFunction((p) => window.__debug.control!.ajuste.potencia === p && window.__debug.control!.puedeDisparar === true, potencia);
}

async function captura(page: Page, nombre: string, tamano: Tamano): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/trayectoria-${nombre}-${tamano.ancho}x${tamano.alto}.png` });
}

const trayectoria = (page: Page) => page.evaluate(() => window.__debug.trayectoriaPantalla);

async function esperarSimulada(page: Page): Promise<void> {
  try {
    // Tras cargarEscenario la mira tarda unos frames en salir de la nave nueva.
    await page.waitForFunction(() => window.__debug.trayectoriaPantalla?.modo === "simulada", undefined, { timeout: 20000 });
    await page.waitForTimeout(500);
  } catch (e) {
    const estado = await page.evaluate(() => ({
      t: window.__debug.trayectoriaPantalla,
      p: window.__debug.previsualizacion,
      naves: window.__debug.naves,
      mundo: window.__debug.mundo,
      calculos: window.__debug.calculosPrevisualizacion,
      lienzo: document.querySelector("#game-container canvas")!.getBoundingClientRect().toJSON(),
    }));
    throw new Error(`la trayectoria no llegó a 'simulada': ${JSON.stringify(estado)}`, { cause: e });
  }
}

for (const tamano of [MOVIL, TABLETA, HORIZONTAL]) {
  test(`tra-1: la trayectoria mide L/8 y L/4 sobre el lado mayor, y la mosca abre el doble (${tamano.ancho}x${tamano.alto})`, async ({ page }) => {
    test.setTimeout(180000);
    await preparar(page, tamano);
    const L = Math.max(tamano.ancho, tamano.alto);

    await cargar(page, "pepinazo-cortesia", 60, 50);
    await esperarSimulada(page);
    const normal = (await trayectoria(page))!;
    expect(normal.visible).toBe(true);
    expect(normal.L).toBe(L);
    expect(Math.abs(normal.tramo1.radioPx - L / 8)).toBeLessThanOrEqual(1);
    expect(Math.abs(normal.tramo2.radioPx - L / 4)).toBeLessThanOrEqual(1);
    // La línea termina a L/4 o antes, si choca con un cuerpo del mapa.
    expect(normal.longitudPantallaPx).toBeLessThanOrEqual(L / 4 + 2);
    expect(normal.longitudPantallaPx).toBeGreaterThan(0);
    expect([normal.tramo1.semiaperturaGrados, normal.tramo2.semiaperturaGrados]).toEqual([9, 45]);
    await captura(page, "tra-1-arma-por-defecto", tamano);

    await cargar(page, "mosca-cojonera", 60, 50);
    await page.waitForFunction(() => window.__debug.trayectoriaPantalla?.tramo1.semiaperturaGrados === 18);
    await esperarSimulada(page);
    const mosca = (await trayectoria(page))!;
    expect([mosca.tramo1.semiaperturaGrados, mosca.tramo2.semiaperturaGrados]).toEqual([18, 90]);
    expect(mosca.L).toBe(L);
    await captura(page, "tra-1-mosca", tamano);
  });
}

test("tra-2 y tra-4: durante un gesto ningún fotograma oculta la trayectoria, la geometría no depende de la potencia y el apuntado responde en ≤ 200 ms", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);

  await cargar(page, "pepinazo-cortesia", 60, 50);
  await esperarSimulada(page);
  await page.evaluate(() => {
    const w = window as unknown as { __ocultaciones: number; __muestras: number; __parar: boolean };
    w.__ocultaciones = 0;
    w.__muestras = 0;
    w.__parar = false;
    const muestrear = () => {
      w.__muestras++;
      if (window.__debug.trayectoriaPantalla?.visible !== true) w.__ocultaciones++;
      if (!w.__parar) requestAnimationFrame(muestrear);
    };
    requestAnimationFrame(muestrear);
  });

  const caja = (await page.locator("#game-container canvas").boundingBox())!;
  const centro = await page.evaluate(
    ({ x, y, w, h }) => {
      const m = window.__debug.mundo!;
      return { x: x + 0.5 * w, y: y + 0.5 * h };
    },
    { x: caja.x, y: caja.y, w: caja.width, h: caja.height },
  );
  await page.mouse.move(centro.x + 100, centro.y);
  await page.mouse.down();
  for (let i = 1; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    await page.mouse.move(centro.x + Math.cos(a) * 100, centro.y - Math.sin(a) * 100);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  const { ocultaciones, muestras } = await page.evaluate(() => {
    const w = window as unknown as { __ocultaciones: number; __muestras: number; __parar: boolean };
    w.__parar = true;
    return { ocultaciones: w.__ocultaciones, muestras: w.__muestras };
  });
  expect(muestras).toBeGreaterThan(20);
  expect(ocultaciones).toBe(0);

  const medidas = await page.evaluate(() => window.__debug.latencias!().filter((m) => m.nombre === "apuntado").map((m) => m.ms));
  expect(medidas.length).toBeGreaterThan(0);
  expect(Math.max(...medidas)).toBeLessThanOrEqual(200);

  // Misma longitud en pantalla con potencia baja y alta (la geometría no mira la potencia).
  await cargar(page, "pepinazo-cortesia", 60, 20);
  await esperarSimulada(page);
  const baja = (await trayectoria(page))!;
  await cargar(page, "pepinazo-cortesia", 60, 100);
  await esperarSimulada(page);
  const alta = (await trayectoria(page))!;
  expect([alta.tramo1, alta.tramo2, alta.L]).toEqual([baja.tramo1, baja.tramo2, baja.L]);
  expect(baja.longitudPantallaPx).toBeLessThanOrEqual(baja.tramo2.radioPx + 2);
  expect(alta.longitudPantallaPx).toBeLessThanOrEqual(alta.tramo2.radioPx + 2);

  // Con el cálculo fuera de presupuesto sigue viéndose, en cuñas rectas.
  await page.evaluate(() => window.__debug.forzarMiraOculta!(true));
  await page.waitForFunction(() => window.__debug.trayectoriaPantalla?.modo === "cunas", undefined, { timeout: 30000 });
  expect((await trayectoria(page))!.visible).toBe(true);
  await captura(page, "tra-2-cunas", MOVIL);
});

test("tra-3: la mira antigua ya no existe", async ({ page }) => {
  await preparar(page, MOVIL);
  expect(await page.evaluate(() => "bandaDispersion" in window.__debug)).toBe(false);
});
