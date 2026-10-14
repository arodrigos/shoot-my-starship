import { test, expect, type Page } from "@playwright/test";
import { plegarConsola } from "./utilesApuntado";

// apuntado-dedo: gesto relativo. Los movimientos se hacen de un solo
// pointermove (steps: 1) para que la descomposición en giro y fuerza se mida
// sobre la línea nave→dedo de partida, como pide el caso de aceptación. Las
// capturas (CAPTURAS_DIR) son para el juicio visual del gatekeeper.
type Tamano = { ancho: number; alto: number };
const MOVIL: Tamano = { ancho: 360, alto: 640 };
const TABLETA: Tamano = { ancho: 820, alto: 1180 };
const HORIZONTAL: Tamano = { ancho: 1180, alto: 820 };

async function preparar(page: Page, tamano: Tamano, query = ""): Promise<void> {
  await page.setViewportSize({ width: tamano.ancho, height: tamano.alto });
  await page.goto(`/?modo=barra-libre${query}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

async function cargarEscenario(page: Page): Promise<void> {
  await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    window.__debug.cargarEscenario!({
      naves: [
        { x: mundo.ancho / 2, y: mundo.alto * 0.75, integridad: 150 },
        { x: mundo.ancho * 0.2, y: mundo.alto * 0.2, integridad: 150 },
      ],
      arma: "pepinazo-cortesia",
      anguloGrados: 45,
      potencia: 50,
    });
  });
  await page.waitForFunction(() => window.__debug.control!.ajuste.potencia === 50 && window.__debug.control!.puedeDisparar === true);
}

async function captura(page: Page, nombre: string, tamano: Tamano): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/apuntado-dedo-${nombre}-${tamano.ancho}x${tamano.alto}.png` });
}

const ajuste = (page: Page) => page.evaluate(() => window.__debug.control!.ajuste);

// Apoya el dedo a `dx` px a la derecha de la nave sin mover nada y devuelve la
// posición de la nave que usa el juego.
async function apoyar(page: Page, dx: number): Promise<{ nave: { x: number; y: number }; dedo: { x: number; y: number } }> {
  const caja = (await page.locator("#game-container canvas").boundingBox())!;
  const estimada = await page.evaluate(({ x, y, w, h }) => {
    const n = window.__debug.naves![0];
    const m = window.__debug.mundo!;
    return { x: x + (n.x / m.ancho) * w, y: y + ((n.y as number) / m.alto) * h };
  }, { x: caja.x, y: caja.y, w: caja.width, h: caja.height });
  await page.mouse.move(estimada.x + dx, estimada.y);
  await page.mouse.down();
  await page.waitForFunction(() => window.__debug.flechaApuntado !== undefined);
  const f = await page.evaluate(() => window.__debug.flechaApuntado!);
  const nave = { x: f.naveX, y: f.naveY };
  // El dedo se recoloca exactamente a dx de la nave real.
  await page.mouse.up();
  const dedo = { x: nave.x + dx, y: nave.y };
  await page.mouse.move(dedo.x, dedo.y);
  await page.mouse.down();
  return { nave, dedo };
}

for (const tamano of [MOVIL, TABLETA, HORIZONTAL]) {
  test(`dedo-1: el gesto relativo gira con el movimiento lateral y cambia la fuerza al alejarse (${tamano.ancho}x${tamano.alto})`, async ({ page }) => {
    test.setTimeout(180000);
    await preparar(page, tamano);
    await cargarEscenario(page);
    await plegarConsola(page);
    const { dedo } = await apoyar(page, 100);

    // El primer toque no cambia nada.
    expect(await ajuste(page)).toMatchObject({ anguloGrados: 45, potencia: 50 });

    // Perpendicular a la línea nave→dedo: 40 px hacia arriba → +10°.
    await page.mouse.move(dedo.x, dedo.y - 40, { steps: 8 });
    let a = await ajuste(page);
    expect(Math.abs(a.anguloGrados - 55)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.potencia - 50)).toBeLessThanOrEqual(0.5);

    // Radial: 50 px más lejos de la nave en la línea nave→dedo del apoyo
    // (los ejes se fijan al apoyar el dedo) → +15 de fuerza. Troceado en
    // pasos de 5 px, como un táctil real: el resultado no puede depender de
    // cuántos eventos llegan.
    await page.mouse.move(dedo.x + 50, dedo.y - 40, { steps: 10 });
    a = await ajuste(page);
    expect(Math.abs(a.anguloGrados - 55)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.potencia - 65)).toBeLessThanOrEqual(0.5);

    // La flecha y su etiqueta se ven, y el dedo no está encima de la etiqueta.
    await page.waitForFunction(() => window.__debug.flechaApuntado?.etiqueta === "55° · 65");
    const f = await page.evaluate(() => window.__debug.flechaApuntado!);
    expect(Math.hypot(f.etiquetaX - f.dedoX, f.etiquetaY - f.dedoY)).toBeGreaterThanOrEqual(40);
    expect(Math.hypot(f.etiquetaX - f.naveX, f.etiquetaY - f.naveY)).toBeGreaterThan(30);
    await captura(page, "arrastre", tamano);

    await page.mouse.up();
    await page.getByTestId("disparar").click();
    // ultimoDisparo se fija al resolverse el tiro, antes de animarlo: no hace
    // falta esperar al vuelo entero, que con render por software tarda.
    await page.waitForFunction(() => window.__debug.ultimoDisparo != null, undefined, { timeout: 30000 });
    const disparo = await page.evaluate(() => window.__debug.ultimoDisparo!);
    expect(Math.abs(disparo.anguloGrados - 55)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(disparo.potencia - 65)).toBeLessThanOrEqual(0.5);
  });
}

test("dedo-1 (límites): la fuerza satura, un toque no cambia nada y empezar sobre la nave funciona", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);
  await cargarEscenario(page);
  await plegarConsola(page);
  const { nave, dedo } = await apoyar(page, 100);

  // Un temblor de 2 px no es un gesto.
  await page.mouse.move(dedo.x, dedo.y - 2);
  expect(await ajuste(page)).toMatchObject({ anguloGrados: 45, potencia: 50 });
  await page.mouse.up();

  // Alejando 400 px se queda en 100.
  await page.mouse.move(dedo.x, dedo.y);
  await page.mouse.down();
  await page.mouse.move(dedo.x + 400, dedo.y);
  expect((await ajuste(page)).potencia).toBe(100);
  await page.mouse.up();

  // A menos de 30 px de la nave: la flecha (0°) es el eje radial. Mover el
  // dedo hacia arriba gira, hacia el lado sube la fuerza.
  await page.evaluate(() => window.__debug.fijarApuntado!(0, 50));
  await page.mouse.move(nave.x + 10, nave.y);
  await page.mouse.down();
  await page.mouse.move(nave.x + 10, nave.y - 20);
  const a = await ajuste(page);
  expect(Math.abs(a.anguloGrados - 5)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(a.potencia - 50)).toBeLessThanOrEqual(0.5);
  await page.mouse.up();
});

test("dedo-2: la ayuda del gesto sale la primera vez, se va tras el primer arrastre y no vuelve al recargar", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);
  await plegarConsola(page);
  const texto = "Apoya el dedo y arrastra: de lado giras, y acercándolo o alejándolo de tu nave cambias la fuerza";
  await expect(page.getByTestId("ayuda-apuntado")).toContainText(texto);
  await captura(page, "ayuda", MOVIL);
  const { dedo } = await apoyar(page, 100);
  await page.mouse.move(dedo.x, dedo.y - 40);
  await expect(page.getByTestId("ayuda-apuntado")).toHaveCount(0);
  await page.mouse.up();

  await page.reload();
  await page.getByTestId("boton-jugar").click();
  await page.waitForFunction(() => window.__debug?.control?.puedeDisparar === true, undefined, { timeout: 60000 });
  await expect(page.getByTestId("ayuda-apuntado")).toHaveCount(0);
});

test("dedo-3: la flecha responde en menos de 200 ms y el panel ?rendimiento=1 lo enseña", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL, "&rendimiento=1");
  await cargarEscenario(page);
  await plegarConsola(page);
  const { dedo } = await apoyar(page, 100);
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(dedo.x + (i % 2 === 0 ? 3 : -3) * 2, dedo.y - i * 2);
    await page.waitForFunction((n) => window.__debug.latencias!().length >= n, Math.min(i, 5), { timeout: 10000 });
  }
  const medidas = await page.evaluate(() => window.__debug.latencias!().map((m) => m.ms).sort((x, y) => x - y));
  expect(medidas.length).toBeGreaterThanOrEqual(20);
  expect(medidas[Math.floor(medidas.length * 0.95) - 1]).toBeLessThanOrEqual(200);
  await expect(page.getByTestId("hud-rendimiento")).toContainText(/apuntado: \d+ ms/, { timeout: 5000 });
  await captura(page, "panel-rendimiento", MOVIL);
  await page.mouse.up();
});
