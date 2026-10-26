import { test, expect, type Page } from "@playwright/test";

// avisos-fuera-de-naves (av-1..av-5, #312): la ayuda del apuntado vive en la
// zona de la consola y los avisos de paso no pisan ni recogen toques de las
// naves. Todo se mide en px CSS con __debug.zonasCamara(), esperando con
// polling sobre el estado real.
type Tamano = { nombre: string; ancho: number; alto: number };
const TAMANOS: Tamano[] = [
  { nombre: "360x640", ancho: 360, alto: 640 },
  { nombre: "820x1180", ancho: 820, alto: 1180 },
  { nombre: "1180x820", ancho: 1180, alto: 820 },
];

test.beforeEach(async ({}, testInfo) => {
  testInfo.setTimeout(240_000);
});

async function capturar(page: Page, nombre: string): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nombre}.png` });
}

// Partida nueva con la ayuda del apuntado sin cerrar (contexto sin almacenamiento).
async function preparar(page: Page, t: Tamano): Promise<void> {
  await page.setViewportSize({ width: t.ancho, height: t.alto });
  await page.goto("/?modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined && window.__debug.zonasCamara !== undefined,
    undefined,
    { timeout: 60000 },
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await expect(page.getByTestId("ayuda-apuntado")).toBeVisible();
}

// Naves en fracciones del mundo.
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
        conservarAyuda: true,
      });
    },
    { a: f0, b: f1 },
  );
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await esperarQuieta(page);
}

async function esperarQuieta(page: Page): Promise<void> {
  // El estado completo en el mensaje de fallo: sin él un timeout no dice por qué.
  await expect
    .poll(async () => JSON.stringify(await page.evaluate(() => window.__debug.zonasCamara!())), { timeout: 40000, intervals: [500] })
    .toContain('"valido":true');
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

async function cajas(page: Page) {
  return page.evaluate(() => {
    const r = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number } | undefined;
    return {
      ayuda: r("ayuda-apuntado"),
      cerrar: r("ayuda-apuntado-cerrar"),
      consola: r("consola"),
      capa: r("capa-avisos"),
      naves: window.__debug.zonasCamara!().objetivos.filter((o) => o.tipo === "nave").map((o) => o.css),
    };
  });
}

function cruza(a: { x: number; y: number; width: number; height: number }, n: { x: number; y: number; ancho: number; alto: number }): boolean {
  // Medio píxel de tolerancia: la cámara deja la nave pegada al borde de la zona
  // y el redondeo de coma flotante no es un solape.
  const t = 0.5;
  return a.x + t < n.x + n.ancho && n.x + t < a.x + a.width && a.y + t < n.y + n.alto && n.y + t < a.y + a.height;
}

for (const t of TAMANOS) {
  test(`av-1: la ayuda y su ✕ no tocan ninguna nave a ${t.nombre}`, async ({ page }) => {
    await preparar(page, t);
    // Nave propia donde el refutador encontró el ✕ (306,160 a 360x640), escalado.
    await cargar(page, { fx: 306 / 360, fy: 160 / 640 }, { fx: 0.3, fy: 0.3 });
    const c = await cajas(page);
    expect(c.ayuda, "la ayuda sigue visible").toBeDefined();
    expect(c.cerrar!.width).toBeGreaterThanOrEqual(44);
    expect(c.cerrar!.height).toBeGreaterThanOrEqual(44);
    for (const nave of c.naves) {
      expect(cruza(c.ayuda!, nave), "bocadillo sobre una nave").toBe(false);
      expect(cruza(c.cerrar!, nave), "✕ sobre una nave").toBe(false);
    }
    await capturar(page, `avisos-fuera-de-naves-av-1-${t.nombre}`);
  });
}

test("av-1: con la consola oculta la ayuda sale sobre la pestaña y tampoco toca naves", async ({ page }) => {
  await preparar(page, TAMANOS[0]);
  await page.getByTestId("boton-ocultar-consola").click();
  await expect(page.getByTestId("pestana-consola")).toBeVisible();
  await cargar(page, { fx: 306 / 360, fy: 160 / 640 }, { fx: 0.3, fy: 0.9 });
  await expect(page.getByTestId("ayuda-apuntado")).toHaveCount(1);
  const c = await cajas(page);
  const estado = JSON.stringify({ c, z: await page.evaluate(() => window.__debug.zonasCamara!()) });
  for (const nave of c.naves) expect(cruza(c.ayuda!, nave), estado).toBe(false);
  await capturar(page, "avisos-fuera-de-naves-av-1-oculta-360x640");
});

test("av-2: con la ayuda visible, el toque sobre la nave llega al lienzo y cambia el apuntado", async ({ page }) => {
  await preparar(page, TAMANOS[0]);
  await cargar(page, { fx: 306 / 360, fy: 160 / 640 }, { fx: 0.3, fy: 0.3 });
  const c = await cajas(page);
  for (const nave of c.naves) {
    const tag = await page.evaluate((n) => document.elementFromPoint(n.x + n.ancho / 2, n.y + n.alto / 2)?.tagName, nave);
    expect(tag).toBe("CANVAS");
  }
  const antes = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
  const n = c.naves[0];
  const cx = n.x + n.ancho / 2;
  const cy = n.y + n.alto * 0.7;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 80, cy, { steps: 6 });
  await page.mouse.move(cx - 56, cy - 56, { steps: 6 });
  await page.mouse.move(cx, cy - 80, { steps: 6 });
  await page.mouse.up();
  const despues = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
  expect(Math.abs(despues - antes)).toBeGreaterThanOrEqual(30);
});

test("av-3: ✕ cierra la ayuda, la consola encoge y la cámara reevalúa en 200 ms o menos", async ({ page }) => {
  await preparar(page, TAMANOS[0]);
  await cargar(page, { fx: 0.3, fy: 0.2 }, { fx: 0.7, fy: 0.9 });
  const antes = await cajas(page);
  await capturar(page, "avisos-fuera-de-naves-av-3-antes-360x640");
  await page.getByTestId("ayuda-apuntado-cerrar").click();
  await expect(page.getByTestId("ayuda-apuntado")).toHaveCount(0);
  await esperarQuieta(page);
  const despues = await cajas(page);
  expect(despues.consola!.height).toBeLessThanOrEqual(antes.consola!.height);
  const latencia = await page.evaluate(() => {
    return window.__debug.latencias!().filter((x) => x.nombre === "reencuadre").at(-1)?.ms;
  });
  if (latencia !== undefined) expect(latencia).toBeLessThanOrEqual(200);
  expect(await page.evaluate(() => window.__debug.zonasCamara!().valido)).toBe(true);
  await capturar(page, "avisos-fuera-de-naves-av-3-despues-360x640");
});

test("av-4/av-5: el aviso de paso se coloca donde no pisa naves y no recoge toques", async ({ page }) => {
  await preparar(page, TAMANOS[0]);
  await page.getByTestId("ayuda-apuntado-cerrar").click();
  // Naves arriba: el aviso va justo encima de la consola.
  await cargar(page, { fx: 0.3, fy: 0.1 }, { fx: 0.7, fy: 0.1 });
  const reencuadres = await page.evaluate(() => window.__debug.zonasCamara!().reencuadres);
  await page.evaluate(() => window.__debug.publicarResumenPrueba!("desplazado-por-bisagra"));
  await expect(page.getByTestId("capa-avisos")).toHaveAttribute("data-anclaje", /.+/);
  const c = await cajas(page);
  for (const nave of c.naves) expect(cruza(c.capa!, nave), "la capa pisa una nave").toBe(false);
  if (c.capa!.y > 130) expect(c.consola!.y - (c.capa!.y + c.capa!.height)).toBeLessThanOrEqual(16);
  expect(await page.evaluate(() => window.__debug.zonasCamara!().reencuadres), "el aviso no mueve la cámara").toBe(reencuadres);
  for (const nave of c.naves) {
    const tag = await page.evaluate((n) => document.elementFromPoint(n.x + n.ancho / 2, n.y + n.alto * 0.7)?.tagName, nave);
    expect(tag).toBe("CANVAS");
  }
  await capturar(page, "avisos-fuera-de-naves-av-4-naves-arriba-360x640");
});

// av-broma: el bocadillo del resumen se ve a los tres tamaños y sigue ahí pasado
// el plazo de los resúmenes normales (el gancho lo publica persistente), sin pisar
// ninguna nave.
for (const t of TAMANOS) {
  test(`av-broma: el bocadillo del resumen sigue a la vista y no pisa naves a ${t.nombre}`, async ({ page }) => {
    await preparar(page, t);
    await page.getByTestId("ayuda-apuntado-cerrar").click();
    await cargar(page, { fx: 0.3, fy: 0.3 }, { fx: 0.7, fy: 0.3 });
    await page.evaluate(() => window.__debug.publicarResumenPrueba!("desplazado-por-bisagra"));
    await expect(page.getByTestId("resumen-texto")).toBeVisible();
    // Más que MS_MINIMOS_RESUMEN: un resumen normal ya habría caducado.
    await page.waitForTimeout(7000);
    await expect(page.getByTestId("resumen-texto")).toBeVisible();
    const c = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="panel-bromas"]')!.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number };
      return { r, naves: window.__debug.zonasCamara!().objetivos.filter((o) => o.tipo === "nave").map((o) => o.css), ancho: innerWidth, alto: innerHeight };
    });
    expect(c.r.x).toBeGreaterThanOrEqual(0);
    expect(c.r.y).toBeGreaterThanOrEqual(0);
    expect(c.r.x + c.r.width).toBeLessThanOrEqual(c.ancho);
    expect(c.r.y + c.r.height).toBeLessThanOrEqual(c.alto);
    for (const nave of c.naves) expect(cruza(c.r, nave), "el bocadillo pisa una nave").toBe(false);
    await capturar(page, `avisos-fuera-de-naves-av-broma-${t.nombre}`);
  });
}

// Partida normal (sin escenarios, que cierran las ayudas) con «Texto grande»: la
// ayuda de la cámara es persistente y no puede tapar ninguna nave. Se compara
// con getBoundingClientRect porque la ayuda no recoge punteros.
for (const t of TAMANOS) {
  test(`av-camara: con «Texto grande» ninguna ayuda ni aviso tapa una nave a ${t.nombre}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("legibilidad:texto-grande", "1"));
    await page.setViewportSize({ width: t.ancho, height: t.alto });
    await page.goto("/?mapa=calma-de-los-restos");
    await page.getByTestId("humanos-1").click();
    await page.getByTestId("ias-1").click();
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(
      () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.zonasCamara !== undefined,
      undefined,
      { timeout: 60000 },
    );
    if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
    await expect(page.getByTestId("ayuda-camara")).toBeVisible();
    await page.waitForFunction(() => window.__debug.zonasCamara!().valido === true, undefined, { timeout: 30000 }).catch(async () => {
      throw new Error("SONDA " + JSON.stringify(await page.evaluate(() => ({ z: window.__debug.zonasCamara!(), fila: document.querySelector('[data-testid="fila-avisos"]')?.getBoundingClientRect(), cam: document.querySelector('[data-testid="ayuda-camara"]')?.getBoundingClientRect() }))));
    });
    const m = await page.evaluate(() => {
      const caja = (e: Element) => e.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number };
      const sel = '[data-testid="ayuda-camara"], [data-testid="capa-avisos"] > *, [data-testid="fila-avisos"] > *';
      const filaAvisos = document.querySelector('[data-testid="fila-avisos"]');
      return {
        cajas: Array.from(document.querySelectorAll(sel)).map((e) => ({ id: e.getAttribute("data-testid") ?? e.tagName, ...caja(e) })),
        recortada: filaAvisos !== null && filaAvisos.scrollHeight > filaAvisos.clientHeight + 1,
        naves: window.__debug.zonasCamara!().objetivos.filter((o) => o.tipo === "nave").map((o) => o.css),
      };
    });
    expect(m.cajas.some((c) => c.id === "ayuda-camara"), "la ayuda de la cámara está medida").toBe(true);
    expect(m.recortada, "la fila de avisos no recorta la ayuda con scroll").toBe(false);
    for (const c of m.cajas) for (const nave of m.naves) expect(cruza(c, nave), `${c.id} sobre una nave: ${JSON.stringify({ c, nave })}`).toBe(false);
    await capturar(page, `avisos-fuera-de-naves-av-camara-texto-grande-${t.nombre}`);
  });
}
