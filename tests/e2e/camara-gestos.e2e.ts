import { test, expect, type CDPSession, type Page } from "@playwright/test";
import { plegarConsola } from "./utilesApuntado";

// camara-gestos: pellizco y arrastre de dos dedos con eventos táctiles reales
// de CDP (llegan al navegador como pointerType "touch"). Las capturas
// (CAPTURAS_DIR) son para el juicio visual del gatekeeper.
type Tamano = { ancho: number; alto: number };
const MOVIL: Tamano = { ancho: 360, alto: 640 };
const TABLETA: Tamano = { ancho: 820, alto: 1180 };
const HORIZONTAL: Tamano = { ancho: 1180, alto: 820 };
const TAMANOS = [MOVIL, TABLETA, HORIZONTAL];

test.use({ hasTouch: true });
// El WebGL por software tarda en asentar cada escenario; el primer caso recorre tres tamaños.
test.beforeEach(async ({}, testInfo) => {
  testInfo.setTimeout(300_000);
});

type Punto = { x: number; y: number };

async function tactil(cdp: CDPSession, tipo: "touchStart" | "touchMove" | "touchEnd", puntos: readonly Punto[]): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints: puntos.map((p, id) => ({ x: p.x, y: p.y, id })) });
}

async function preparar(page: Page, tamano: Tamano, query = ""): Promise<void> {
  await page.setViewportSize({ width: tamano.ancho, height: tamano.alto });
  await page.goto(`/?modo=barra-libre${query}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// Naves en y≈0,2 y 0,75 del mundo: a 360x640 la mitad del mundo cae bajo los
// avisos DOM y la consola, y los dedos tienen que caer sobre el lienzo.
async function cargar(page: Page): Promise<void> {
  await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    window.__debug.cargarEscenario!({
      naves: [
        { x: mundo.ancho * 0.35, y: mundo.alto * 0.45, integridad: 150 },
        { x: mundo.ancho * 0.7, y: mundo.alto * 0.25, integridad: 150 },
      ],
      arma: "pepinazo-cortesia",
      anguloGrados: 45,
      potencia: 50,
    });
  });
  await page.waitForFunction(() => window.__debug.control!.ajuste.potencia === 50 && window.__debug.control!.puedeDisparar === true);
  await esperarQuieta(page);
}

async function esperarQuieta(page: Page): Promise<void> {
  const huella = () =>
    page.evaluate(() => {
      const c = document.querySelector("#game-container canvas")!.getBoundingClientRect();
      const n = window.__debug.naves![0];
      return `${c.x},${c.y},${c.width},${c.height},${n.x},${n.y}`;
    });
  let anterior = await huella();
  for (let quietas = 0; quietas < 3; ) {
    await page.waitForTimeout(250);
    const actual = await huella();
    quietas = actual === anterior ? quietas + 1 : 0;
    anterior = actual;
  }
}

async function captura(page: Page, nombre: string, tamano: Tamano): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/camara-gestos-${nombre}-${tamano.ancho}x${tamano.alto}.png` });
}

const camara = (page: Page) => page.evaluate(() => window.__debug.camara!);
const ajuste = (page: Page) => page.evaluate(() => window.__debug.control!.ajuste);

// Zona libre del lienzo, por encima de la consola y de la capa de avisos.
async function centroLibre(page: Page): Promise<Punto> {
  const caja = (await page.locator("#game-container canvas").boundingBox())!;
  const nave = await page.evaluate(() => ({ n: window.__debug.naves![0], m: window.__debug.mundo! }));
  return { x: caja.x + (nave.n.x / nave.m.ancho) * caja.width, y: caja.y + ((nave.n.y as number) / nave.m.alto) * caja.height };
}

// Punto del lienzo donde caben los dos dedos de un pellizco (hasta 160 px de
// separación) sin que ninguno caiga sobre un panel DOM: un toque fuera del
// lienzo no llega a la cámara, que es lo que ocurre con las naves en 360x640.
async function puntoPellizco(page: Page): Promise<Punto> {
  const punto = await page.evaluate(() => {
    const canvas = document.querySelector("#game-container canvas")!;
    const caja = canvas.getBoundingClientRect();
    for (let fy = 0.3; fy <= 0.95; fy += 0.05) {
      for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7]) {
        const x = caja.left + caja.width * fx;
        const y = caja.top + caja.height * fy;
        if ([-80, 0, 80].every((d) => document.elementFromPoint(x + d, y) === canvas)) return { x, y };
      }
    }
    return null;
  });
  if (punto === null) throw new Error("no hay un punto del lienzo libre de paneles para pellizcar");
  return punto;
}

// Pellizco de `desde` a `hasta` px entre los dos dedos, alrededor de `medio`, en 10 pasos.
async function pellizcar(cdp: CDPSession, medio: Punto, desde: number, hasta: number): Promise<void> {
  const dedos = (sep: number): Punto[] => [{ x: medio.x - sep / 2, y: medio.y }, { x: medio.x + sep / 2, y: medio.y }];
  await tactil(cdp, "touchStart", dedos(desde));
  for (let i = 1; i <= 10; i++) await tactil(cdp, "touchMove", dedos(desde + ((hasta - desde) * i) / 10));
}

async function arrastrar(cdp: CDPSession, medio: Punto, sep: number, dx: number): Promise<void> {
  const dedos = (m: Punto): Punto[] => [{ x: m.x - sep / 2, y: m.y }, { x: m.x + sep / 2, y: m.y }];
  for (let i = 1; i <= 10; i++) await tactil(cdp, "touchMove", dedos({ x: medio.x + (dx * i) / 10, y: medio.y }));
}

test("cam-1, cam-3, cam-10: pellizco y arrastre con dos dedos, «Ver todo» y la ayuda", async ({ page }) => {
  for (const tamano of TAMANOS) {
    await preparar(page, tamano, "&rendimiento=1");
    await plegarConsola(page);
    await cargar(page);
    const cdp = await page.context().newCDPSession(page);
    const mundo = await page.evaluate(() => window.__debug.mundo!);

    // cam-10: la ayuda sale en el primer turno humano y se va al primer gesto.
    await expect(page.getByTestId("ayuda-camara")).toContainText("Pellizca con dos dedos");
    await expect(page.getByTestId("ver-todo")).toHaveCount(0);
    const antes = await camara(page);
    expect(antes.zoom).toBe(1);
    expect(antes.modo).toBe("auto");
    await captura(page, "cam-1-antes", tamano);

    const ajusteAntes = await ajuste(page);
    const medio = await puntoPellizco(page);
    await pellizcar(cdp, medio, 60, 120);
    await expect.poll(async () => (await camara(page)).zoom).toBeGreaterThanOrEqual(1.8);
    const zoom = await camara(page);
    expect(zoom.ancho).toBeLessThanOrEqual(mundo.ancho * 0.56);
    expect(zoom.modo).toBe("manual");
    await captura(page, "cam-1-pellizco", tamano);
    await expect(page.getByTestId("ayuda-camara")).toHaveCount(0);

    // Arrastre de 100 px con dos dedos: el encuadre se mueve ≈ 100/zoom unidades de mundo por px CSS.
    const xAntes = (await camara(page)).x;
    await arrastrar(cdp, medio, 120, -100);
    await expect.poll(async () => Math.abs((await camara(page)).x - xAntes)).toBeGreaterThan(1);
    await tactil(cdp, "touchEnd", []);
    const caja = (await page.locator("#game-container canvas").boundingBox())!;
    const esperado = (100 / caja.width) * ((await camara(page)).ancho);
    expect(Math.abs((await camara(page)).x - xAntes)).toBeGreaterThan(esperado * 0.5);
    // cam-1: sin cambiar el apuntado.
    expect(await ajuste(page)).toEqual(ajusteAntes);
    await captura(page, "cam-1-arrastre", tamano);

    // cam-3
    await expect(page.getByTestId("ver-todo")).toBeVisible();
    const boton = (await page.getByTestId("ver-todo").boundingBox())!;
    expect(boton.width).toBeGreaterThanOrEqual(44);
    expect(boton.height).toBeGreaterThanOrEqual(44);
    await page.getByTestId("ver-todo").click();
    await expect.poll(async () => (await camara(page)).modo, { timeout: 3000 }).toBe("auto");
    const fin = await camara(page);
    expect(Math.abs(fin.ancho - mundo.ancho)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("ver-todo")).toHaveCount(0);
    await captura(page, "cam-3-ver-todo", tamano);

    // Medidas de latencia en el panel de ?rendimiento=1 (cam-10).
    const panel = page.getByTestId("hud-rendimiento");
    await expect(panel).toContainText("gesto-camara:");
    await expect(panel).toContainText("ver-todo:");
    const medidas = await page.evaluate(() => window.__debug.latencias!().filter((m) => m.nombre === "gesto-camara" || m.nombre === "ver-todo"));
    expect(medidas.some((m) => m.nombre === "gesto-camara")).toBe(true);
    expect(medidas.some((m) => m.nombre === "ver-todo")).toBe(true);
    // Umbral relativo: el WebGL por software de Actions pinta cada frame en ~250 ms.
    for (const m of medidas) expect(m.ms).toBeLessThanOrEqual(1000);
    if (tamano === MOVIL) await captura(page, "cam-10-panel-rendimiento", tamano);
  }
});

test("cam-2: un segundo dedo tardío devuelve la mira a lo que había y el disparo sale con eso", async ({ page }) => {
  await preparar(page, MOVIL);
  await plegarConsola(page);
  await cargar(page);
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => window.__debug.fijarApuntado!(45, 50));
  const nave = await centroLibre(page);
  const dedo1 = (grados: number, radio: number): Punto => ({ x: nave.x + Math.cos((grados * Math.PI) / 180) * radio, y: nave.y - Math.sin((grados * Math.PI) / 180) * radio });

  await tactil(cdp, "touchStart", [dedo1(0, 100)]);
  for (let g = 0; g <= 80; g += 10) await tactil(cdp, "touchMove", [dedo1(g, 100 + g / 2)]);
  const movida = await ajuste(page);
  expect(movida.anguloGrados).not.toBeCloseTo(45, 0);
  await captura(page, "cam-2-mira-movida", MOVIL);

  // Segundo dedo: el ajuste vuelve a 45/50 y el primero ya no apunta.
  const resto = dedo1(80, 140);
  await tactil(cdp, "touchStart", [resto, { x: nave.x - 60, y: nave.y + 40 }]);
  await expect.poll(() => ajuste(page)).toMatchObject({ anguloGrados: 45, potencia: 50 });
  await tactil(cdp, "touchMove", [dedo1(120, 150), { x: nave.x - 80, y: nave.y + 40 }]);
  await tactil(cdp, "touchEnd", []);
  expect(await ajuste(page)).toMatchObject({ anguloGrados: 45, potencia: 50 });
  await captura(page, "cam-2-mira-restaurada", MOVIL);

  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.ultimoDisparo !== undefined && window.__debug.ultimoDisparo !== null);
  const disparo = await page.evaluate(() => window.__debug.ultimoDisparo!);
  expect(disparo.anguloGrados).toBeCloseTo(45, 5);
  expect(disparo.potencia).toBeCloseTo(50, 5);
});

test("cam-5: con zoom la trayectoria mide lo mismo en pantalla y el apuntado gira alrededor de la nave donde se ve", async ({ page }) => {
  await preparar(page, MOVIL);
  await plegarConsola(page);
  await cargar(page);
  const cdp = await page.context().newCDPSession(page);
  await page.waitForFunction(() => window.__debug.trayectoriaPantalla?.visible === true);
  const t1 = await page.evaluate(() => window.__debug.trayectoriaPantalla!);
  await captura(page, "cam-5-zoom-1", MOVIL);

  await pellizcar(cdp, await puntoPellizco(page), 60, 150);
  await tactil(cdp, "touchEnd", []);
  await expect.poll(async () => (await camara(page)).zoom).toBeGreaterThanOrEqual(2.2);
  await esperarQuieta(page);
  await page.waitForFunction(() => window.__debug.trayectoriaPantalla?.visible === true);
  const t2 = await page.evaluate(() => window.__debug.trayectoriaPantalla!);
  expect(Math.abs(t2.longitudPantallaPx - t1.longitudPantallaPx)).toBeLessThanOrEqual(2);
  expect(Math.abs(t2.tramo1.radioPx - t1.tramo1.radioPx)).toBeLessThanOrEqual(2);
  await captura(page, "cam-5-zoom-2", MOVIL);

  // Vuelta completa alrededor de la nave tal como se ve en pantalla.
  await page.evaluate(() => window.__debug.fijarApuntado!(45, 50));
  await page.waitForFunction(() => window.__debug.control!.ajuste.anguloGrados === 45);
  const centro = await page.evaluate(() => {
    const c = document.querySelector("#game-container canvas")!.getBoundingClientRect();
    const camara = window.__debug.camara!;
    const n = window.__debug.naves![0];
    return { x: c.x + ((n.x - camara.x) / camara.ancho) * c.width, y: c.y + (((n.y as number) - camara.y) / camara.alto) * c.height };
  });
  const sobre = (grados: number): Punto => ({ x: centro.x + Math.cos((grados * Math.PI) / 180) * 70, y: centro.y - Math.sin((grados * Math.PI) / 180) * 70 });
  await tactil(cdp, "touchStart", [sobre(0)]);
  for (let g = 10; g <= 360; g += 10) await tactil(cdp, "touchMove", [sobre(g)]);
  const f = await page.evaluate(() => window.__debug.flechaApuntado!);
  await tactil(cdp, "touchEnd", []);
  const final = await ajuste(page);
  const delta = (((final.anguloGrados - 45 + 540) % 360) - 180);
  expect(Math.abs(delta)).toBeLessThanOrEqual(1);
  // La flecha nace donde está la nave en pantalla.
  expect(Math.hypot(f.naveX - centro.x, f.naveY - centro.y)).toBeLessThanOrEqual(6);
  await captura(page, "cam-5-vuelta", MOVIL);
});

test("cam-6: la rueda y el pellizco del trackpad hacen zoom del juego, no de la página", async ({ page }) => {
  await preparar(page, HORIZONTAL);
  await plegarConsola(page);
  await cargar(page);
  const centro = await centroLibre(page);
  await page.mouse.move(centro.x, centro.y);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await camara(page)).zoom).toBeGreaterThan(1.2);
  const tras = (await camara(page)).zoom ?? 1;
  await page.evaluate(() => {
    const lienzo = document.querySelector("#game-container canvas")!;
    lienzo.dispatchEvent(new WheelEvent("wheel", { deltaY: -50, ctrlKey: true, clientX: 600, clientY: 400, bubbles: true, cancelable: true }));
  });
  await expect.poll(async () => (await camara(page)).zoom).toBeGreaterThan(tras);
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  await captura(page, "cam-6-rueda", HORIZONTAL);
});

test("cam-7: con zoom manual la cámara sigue al proyectil sin acercar más y lo mantiene en el encuadre", async ({ page }) => {
  await preparar(page, MOVIL);
  await plegarConsola(page);
  await cargar(page);
  const cdp = await page.context().newCDPSession(page);
  await pellizcar(cdp, await puntoPellizco(page), 60, 130);
  await tactil(cdp, "touchEnd", []);
  await expect.poll(async () => (await camara(page)).zoom).toBeGreaterThanOrEqual(1.8);
  const zoomInicial = (await camara(page)).zoom ?? 1;
  await page.evaluate(() => window.__debug.fijarApuntado!(60, 90));
  await page.getByTestId("disparar").click();
  let muestras = 0;
  let capturada = false;
  for (let i = 0; i < 400; i++) {
    const m = await page.evaluate(() => ({ p: window.__debug.proyectilEnVuelo ?? null, c: window.__debug.camara! }));
    if (m.p) {
      muestras++;
      expect(m.c.zoom ?? 1).toBeLessThanOrEqual(zoomInicial + 1e-6);
      expect(m.p.x).toBeGreaterThanOrEqual(m.c.x - 8);
      expect(m.p.x).toBeLessThanOrEqual(m.c.x + m.c.ancho + 8);
      expect(m.p.y).toBeGreaterThanOrEqual(m.c.y - 8);
      expect(m.p.y).toBeLessThanOrEqual(m.c.y + m.c.alto + 8);
      if (!capturada && muestras >= 3) {
        capturada = true;
        await captura(page, "cam-7-vuelo", MOVIL);
      }
    } else if (muestras > 0) break;
    await page.waitForTimeout(40);
  }
  expect(muestras).toBeGreaterThan(0);
});

test("cam-4: la cámara vuelve a la vista completa antes del relevo", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("humanos-2").click();
  await page.getByTestId("ias-0").click();
  await page.getByTestId("nombre-jugador-0").pressSequentially("Ana");
  await page.getByTestId("nombre-jugador-1").pressSequentially("Luis");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await plegarConsola(page);
  const cdp = await page.context().newCDPSession(page);
  const caja = (await page.locator("#game-container canvas").boundingBox())!;
  await pellizcar(cdp, { x: caja.x + caja.width / 2, y: caja.y + caja.height * 0.3 }, 60, 130);
  await tactil(cdp, "touchEnd", []);
  await expect.poll(async () => (await camara(page)).zoom).toBeGreaterThanOrEqual(1.8);
  await page.evaluate(() => window.__debug.fijarApuntado!(45, 50));
  await page.getByTestId("disparar").click();
  await expect(page.getByTestId("relevo-jugador")).toContainText("Luis", { timeout: 60000 });
  const c = await camara(page);
  const mundo = await page.evaluate(() => window.__debug.mundo!);
  expect(c.modo).toBe("auto");
  expect(Math.abs(c.ancho - mundo.ancho)).toBeLessThanOrEqual(1);
  await captura(page, "cam-4-relevo", MOVIL);
});
