import { test, expect, type Page } from "@playwright/test";
import { plegarConsola } from "./utilesApuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// apuntado-360: gesto polar de un dedo. Los pointermove se mandan de uno en
// uno, como un táctil. Las capturas (CAPTURAS_DIR) son para el juicio visual
// del gatekeeper.
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
async function apoyar(page: Page, dx: number, dy = 0): Promise<{ nave: { x: number; y: number }; dedo: { x: number; y: number } }> {
  const caja = (await page.locator("#game-container canvas").boundingBox())!;
  const estimada = await page.evaluate(({ x, y, w, h }) => {
    const n = window.__debug.naves![0];
    const m = window.__debug.mundo!;
    return { x: x + (n.x / m.ancho) * w, y: y + ((n.y as number) / m.alto) * h };
  }, { x: caja.x, y: caja.y, w: caja.width, h: caja.height });
  await page.mouse.move(estimada.x + dx, estimada.y + dy);
  await page.mouse.down();
  await page.waitForFunction(() => window.__debug.flechaApuntado !== undefined);
  const f = await page.evaluate(() => window.__debug.flechaApuntado!);
  const nave = { x: f.naveX, y: f.naveY };
  // El dedo se recoloca exactamente a dx de la nave real.
  await page.mouse.up();
  const dedo = { x: nave.x + dx, y: nave.y + dy };
  await page.mouse.move(dedo.x, dedo.y);
  await page.mouse.down();
  return { nave, dedo };
}

// Escenario con la nave lejos de los bordes y la mira dada: el recorrido de
// 100 px de radio cabe en cualquier tamaño con la consola plegada.
async function cargarCentrado(page: Page, anguloGrados: number, potencia: number): Promise<void> {
  await page.evaluate(
    ({ a, p }) => {
      const mundo = window.__debug.mundo!;
      window.__debug.cargarEscenario!({
        naves: [
          { x: mundo.ancho / 2, y: mundo.alto * 0.5, integridad: 150 },
          { x: mundo.ancho * 0.2, y: mundo.alto * 0.2, integridad: 150 },
        ],
        arma: "pepinazo-cortesia",
        anguloGrados: a,
        potencia: p,
      });
    },
    { a: anguloGrados, p: potencia },
  );
  await page.waitForFunction((p) => window.__debug.control!.ajuste.potencia === p && window.__debug.control!.puedeDisparar === true, potencia);
}

// Punto del dedo a `radio` px de la nave en el ángulo de juego `grados`.
const enCirculo = (nave: { x: number; y: number }, grados: number, radio: number) => ({
  x: nave.x + Math.cos((grados * Math.PI) / 180) * radio,
  y: nave.y - Math.sin((grados * Math.PI) / 180) * radio,
});

const distAngular = (a: number, b: number): number => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
};

// a360-1: da una vuelta de `pasos` pasos con el dedo a radio constante y
// anota el ángulo y la fuerza en cada cuarto. Los pointermove se mandan de
// uno en uno, como un táctil.
async function vuelta(page: Page, tamano: Tamano, pasos: number, sentido: 1 | -1, nombre: string): Promise<number[]> {
  const { nave } = await apoyar(page, 100, 0);
  const cuartos: number[] = [];
  for (let i = 1; i <= pasos; i++) {
    const p = enCirculo(nave, (sentido * 360 * i) / pasos, 100);
    await page.mouse.move(p.x, p.y);
    if (i % (pasos / 4) === 0) {
      const a = await ajuste(page);
      cuartos.push(a.anguloGrados);
      expect(Math.abs(a.potencia - 50)).toBeLessThanOrEqual(0.5);
      await captura(page, `${nombre}-cuarto${i / (pasos / 4)}`, tamano);
    }
  }
  return cuartos;
}

for (const tamano of [MOVIL, TABLETA, HORIZONTAL]) {
  test(`a360-1: una vuelta del dedo alrededor de la nave da una vuelta a la flecha, cruzando 0°/360° (${tamano.ancho}x${tamano.alto})`, async ({ page }) => {
    test.setTimeout(180000);
    await preparar(page, tamano);
    await cargarCentrado(page, 350, 50);
    await plegarConsola(page);
    const cuartos = await vuelta(page, tamano, 36, 1, "vuelta");
    // 350° + 90° en cada cuarto: 80°, 170°, 260°, 350°.
    [80, 170, 260, 350].forEach((esperado, i) => expect(distAngular(cuartos[i], esperado), `cuarto ${i + 1}: ${cuartos[i]}`).toBeLessThanOrEqual(2));
    // La flecha dibujada apunta donde dice el ajuste.
    const f = await page.evaluate(() => window.__debug.flechaApuntado!);
    expect(distAngular(f.anguloGrados, 350)).toBeLessThanOrEqual(2);
    await page.mouse.up();
  });
}

test("a360-1 (límites): en sentido horario baja y cruza 0→359, y con 72 pasos de 5° el final coincide", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);
  await cargarCentrado(page, 10, 50);
  await plegarConsola(page);
  const horario = await vuelta(page, MOVIL, 36, -1, "vuelta-horaria");
  [280, 190, 100, 10].forEach((esperado, i) => expect(distAngular(horario[i], esperado)).toBeLessThanOrEqual(2));
  await page.mouse.up();
  await cargarCentrado(page, 350, 50);
  const fina = await vuelta(page, MOVIL, 72, 1, "vuelta-fina");
  expect(distAngular(fina[3], 350)).toBeLessThanOrEqual(0.5);
  await page.mouse.up();
});

test("a360-2: el disparo sale con el ángulo y la fuerza que muestra la flecha tras el gesto", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);
  await cargarCentrado(page, 350, 50);
  await plegarConsola(page);
  await vuelta(page, MOVIL, 36, 1, "disparo-vuelta");
  // Un cuarto de vuelta más y 50 px más lejos de la nave.
  const f0 = await page.evaluate(() => window.__debug.flechaApuntado!);
  const nave = { x: f0.naveX, y: f0.naveY };
  for (let i = 1; i <= 9; i++) {
    const p = enCirculo(nave, 10 * i, 100);
    await page.mouse.move(p.x, p.y);
  }
  const lejos = enCirculo(nave, 90, 150);
  await page.mouse.move(lejos.x, lejos.y);
  const a = await ajuste(page);
  expect(distAngular(a.anguloGrados, 80)).toBeLessThanOrEqual(2);
  expect(Math.abs(a.potencia - 65)).toBeLessThanOrEqual(1);
  await page.waitForFunction(() => window.__debug.flechaApuntado?.etiqueta !== undefined);
  const etiqueta = await page.evaluate(() => window.__debug.flechaApuntado!.etiqueta);
  expect(etiqueta).toBe(`${Math.round(a.anguloGrados)}° · ${Math.round(a.potencia)}`);
  await captura(page, "disparo-etiqueta", MOVIL);
  await page.mouse.up();
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.ultimoDisparo != null, undefined, { timeout: 30000 });
  const disparo = await page.evaluate(() => window.__debug.ultimoDisparo!);
  expect(Math.abs(disparo.anguloGrados - a.anguloGrados)).toBeLessThanOrEqual(0.1);
  expect(Math.abs(disparo.potencia - a.potencia)).toBeLessThanOrEqual(0.1);
});

test("a360-3: el giro responde en menos de 200 ms durante una vuelta completa", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);
  await cargarCentrado(page, 350, 50);
  await plegarConsola(page);
  const { nave } = await apoyar(page, 100, 0);
  for (let i = 1; i <= 36; i++) {
    const p = enCirculo(nave, 10 * i, 100);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction((n) => window.__debug.latencias!().filter((m) => m.nombre === "apuntado").length >= n, Math.min(i, 5), { timeout: 10000 });
  }
  const medidas = await page.evaluate(() => window.__debug.latencias!().filter((m) => m.nombre === "apuntado").map((m) => m.ms).sort((x, y) => x - y));
  // Percentil 95 y no máximo: Actions pinta WebGL por software y un frame suelto puede pasarse.
  expect(medidas[Math.floor(medidas.length * 0.95) - 1]).toBeLessThanOrEqual(200);
  await page.mouse.up();
});

test("a360-4: con la nave en una esquina el gesto gira en el arco libre y la barra de ángulo llega a 225°; la ayuda explica el gesto", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);
  await plegarConsola(page);
  // La ayuda se comprueba antes de cargar el escenario, como en dedo-2.
  await expect(page.getByTestId("ayuda-apuntado")).toContainText("alrededor de tu nave");
  await captura(page, "esquina-ayuda", MOVIL);
  await cargarCentrado(page, 45, 50);
  await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    window.__debug.forzarPosicionNave!(window.__debug.naves![0].id, mundo.ancho * 0.08, mundo.alto * 0.7);
  });
  const { nave } = await apoyar(page, 60, 0);
  // Cuadrante libre: de 0° a 90°, hacia arriba y a la derecha.
  for (let g = 10; g <= 80; g += 10) {
    const p = enCirculo(nave, g, 60);
    await page.mouse.move(p.x, p.y);
  }
  expect(distAngular((await ajuste(page)).anguloGrados, 125)).toBeLessThanOrEqual(2);
  await captura(page, "esquina-gesto", MOVIL);
  await page.mouse.up();
  await page.getByTestId("boton-plegar-consola").click();
  await arrastrarBarraHasta(page, "barra-angulo", 225 / 360);
  expect(distAngular((await ajuste(page)).anguloGrados, 225)).toBeLessThanOrEqual(1);
});

test("a360-5: alejar el dedo en línea recta sube la fuerza sin girar, y la barra de fuerza lo refleja", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);
  await cargarCentrado(page, 90, 50);
  await plegarConsola(page);
  const { nave } = await apoyar(page, 0, -100);
  for (let r = 110; r <= 200; r += 10) {
    const p = enCirculo(nave, 90, r);
    await page.mouse.move(p.x, p.y);
  }
  const a = await ajuste(page);
  expect(Math.abs(a.potencia - 80)).toBeLessThanOrEqual(1);
  expect(distAngular(a.anguloGrados, 90)).toBeLessThanOrEqual(1);
  await page.waitForFunction(() => window.__debug.flechaApuntado?.etiqueta === "90° · 80");
  await captura(page, "radial-etiqueta", MOVIL);
  await page.mouse.up();
  await page.getByTestId("boton-plegar-consola").click();
  await expect(page.getByTestId("barra-potencia")).toHaveAttribute("aria-valuenow", "80");
  await captura(page, "radial-barra", MOVIL);
});

test("a360 (límites): un toque de menos de 4 px no cambia nada y dentro de la zona muerta tampoco", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);
  await cargarCentrado(page, 45, 50);
  await plegarConsola(page);
  const { nave, dedo } = await apoyar(page, 100, 0);
  await page.mouse.move(dedo.x, dedo.y - 2);
  expect(await ajuste(page)).toMatchObject({ anguloGrados: 45, potencia: 50 });
  await page.mouse.up();
  await page.mouse.move(nave.x + 10, nave.y);
  await page.mouse.down();
  await page.mouse.move(nave.x - 10, nave.y - 5);
  expect(await ajuste(page)).toMatchObject({ anguloGrados: 45, potencia: 50 });
  await page.mouse.up();
});

test("dedo-2: la ayuda del gesto sale la primera vez, se va tras el primer arrastre y no vuelve al recargar", async ({ page }) => {
  test.setTimeout(180000);
  await preparar(page, MOVIL);
  await plegarConsola(page);
  const texto = "Gira el dedo alrededor de tu nave para apuntar; aléjalo para más fuerza";
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
