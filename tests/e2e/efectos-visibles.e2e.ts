import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// bug-efectos-visibles (vis-1..vis-4): lo que pasa en la partida se ve.
const TAMANOS = [
  { w: 360, h: 640 },
  { w: 820, h: 1180 },
  { w: 1180, h: 820 },
];

async function abrir(page: Page, w: number, h: number, query = ""): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/?eventos=1&muerte=0&modo=barra-libre${query}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined && window.__debug.forzarEvento !== undefined && window.__debug.fijarObjetos !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  mkdirSync("capturas", { recursive: true });
}

// vis-1: la explosión del minirobot que detona en el cierre del turno.
for (const t of TAMANOS) {
  test(`vis-1: la explosión del minirobot se ve en su punto y el rival pierde vida (${t.w}x${t.h})`, async ({ page }) => {
    test.setTimeout(240000);
    await abrir(page, t.w, t.h);
    await page.evaluate(() => {
      const mundo = window.__debug.mundo!;
      window.__debug.cargarEscenario!({
        naves: [
          { x: 120, y: mundo.alto / 2, integridad: 150 },
          { x: mundo.ancho - 120, y: mundo.alto / 2, integridad: 150 },
        ],
        arma: "pepinazo-cortesia",
        anguloGrados: 45,
        potencia: 60,
        robots: [{ x: mundo.ancho - 160, y: mundo.alto / 2, dueno: 0 }],
      });
    });
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await page.getByTestId("disparar").click();
    // El robot detona al empezar el turno de su dueño: tras jugar la IA.
    // Se espera al destello propio del robot (origen «robot»), que dura ≥ 400 ms
    // opaco, y se mide en el mismo instante: así la prueba no sale verde con la
    // explosión invisible.
    await page.waitForFunction(() => (window.__debug.efectosVisibles ?? []).some((e) => e.origen === "robot"), undefined, { timeout: 200000, polling: "raf" });
    const claro = await page.evaluate(() => {
      const e = window.__debug.efectosVisibles!.find((x) => x.origen === "robot")!;
      const lienzo = document.querySelector<HTMLCanvasElement>("#game-container canvas")!;
      const caja = lienzo.getBoundingClientRect();
      // La cámara ya no encuadra siempre el mundo entero: el punto se lleva al
      // lienzo con la vista real (x, y, ancho, alto de mundo).
      const v = window.__debug.camara!;
      const cx = ((e.x - v.x) / v.ancho) * lienzo.width;
      const cy = ((e.y - v.y) / v.alto) * lienzo.height;
      const porCss = lienzo.width / caja.width;
      const radio = Math.round(20 * porCss);
      const copia = document.createElement("canvas");
      copia.width = lienzo.width;
      copia.height = lienzo.height;
      const ctx = copia.getContext("2d")!;
      ctx.drawImage(lienzo, 0, 0);
      const x0 = Math.max(0, Math.round(cx - radio));
      const y0 = Math.max(0, Math.round(cy - radio));
      const datos = ctx.getImageData(x0, y0, Math.min(lienzo.width - x0, radio * 2), Math.min(lienzo.height - y0, radio * 2)).data;
      let pixeles = 0;
      for (let i = 0; i < datos.length; i += 4) {
        if (0.2126 * datos[i] + 0.7152 * datos[i + 1] + 0.0722 * datos[i + 2] > 200) pixeles++;
      }
      return { pixeles, porCss };
    });
    await page.screenshot({ path: `capturas/bug-efectos-visibles-11-robot-${t.w}x${t.h}.png` });
    // ≥ 600 px² CSS de área clara en un círculo de 20 px CSS alrededor del punto.
    expect(claro.pixeles / (claro.porCss * claro.porCss), "área clara (px² CSS) alrededor de la detonación").toBeGreaterThanOrEqual(600);
    const r = await page.evaluate(() => {
      const d = window.__debug.detonaciones!.find((x) => x.armaId === "minirobot-saltaplanetas")!;
      const explosiones = (window.__debug.efectosVisibles ?? []).filter((e) => e.tipo === "explosion");
      const evento = (window.__debug.ultimosEventos ?? []).find((e) => e.tipo === "robot-detona");
      return { cerca: explosiones.some((e) => Math.hypot(e.x - d.x, e.y - d.y) <= 10), evento: evento ?? null, vidaRival: window.__debug.naves!.find((n) => n.id === 1)!.integridad };
    });
    expect(r.cerca, "una explosión a ≤ 10 u de la detonación del robot").toBe(true);
    expect(r.evento, "el cierre contiene robot-detona").not.toBeNull();
    expect(r.vidaRival).toBeLessThan(150);
  });
}

// vis-2: los nueve eventos con efecto propio.
const EVENTOS = ["loteria", "vitaminas", "virus", "reparacion", "terremoto", "gravedad-x2", "gravedad-mitad", "viento-solar", "agujero-negro"] as const;
for (const tipo of EVENTOS) {
  test(`vis-2: ${tipo} deja su efecto en __debug.efectosVisibles y una captura (360x640)`, async ({ page }) => {
    test.setTimeout(120000);
    await abrir(page, 360, 640);
    await page.evaluate((t) => window.__debug.forzarEvento!(t, 1), tipo);
    await page.waitForFunction((t) => (window.__debug.efectosVisibles ?? []).some((e) => e.tipo === `evento-${t}`), tipo, { timeout: 10000, polling: "raf" });
    await page.screenshot({ path: `capturas/bug-efectos-visibles-10-evento-${tipo}-360x640.png` });
    const entrada = await page.evaluate((t) => (window.__debug.efectosVisibles ?? []).find((e) => e.tipo === `evento-${t}`)!, tipo);
    if (["loteria", "vitaminas", "virus"].includes(tipo)) expect(entrada.nave).toBe(1);
  });
}

// Pone la nave 0 sobre un punto de la ruta del objeto (como corazon.e2e.ts) y
// anota cada efecto de evento con nave que aparezca, porque el de aplicación
// dura menos de un segundo.
async function montarObjeto(page: Page, tipo: "corazon" | "tormenta"): Promise<number> {
  const puntos = await page.evaluate((t) => {
    const mundo = window.__debug.mundo!;
    for (let fila = 1; fila <= 6; fila++) {
      for (let velocidad = 60; velocidad <= 140; velocidad += 20) {
        const objeto = { tipo: t, x: 40, y: (mundo.alto * fila) / 8, vx: velocidad, vy: 0 };
        window.__debug.fijarObjetos!([objeto]);
        const ruta = window.__debug.objetos![0].rutaPrevista;
        if (ruta.length < 181) continue;
        window.__debug.forzarPosicionNave!(0, ruta[120].x, ruta[120].y);
        window.__debug.fijarObjetos!([objeto]);
        const nueva = window.__debug.objetos![0].rutaPrevista;
        const ultimo = nueva[nueva.length - 1];
        if (nueva.length >= 10 && Math.hypot(ultimo.x - ruta[120].x, ultimo.y - ruta[120].y) <= 44) return nueva.length;
      }
    }
    return 0;
  }, tipo);
  expect(puntos, "ruta libre que cruce la nave 0").toBeGreaterThan(0);
  return puntos;
}

for (const tipo of ["corazon", "tormenta"] as const) {
  test(`vis-3: ${tipo} se ve como cuerpo en el mundo y su aplicación deja un efecto en la nave (360x640)`, async ({ page }) => {
    test.setTimeout(300000);
    await abrir(page, 360, 640);
    const integridadAntes = await page.evaluate(() => window.__debug.naves!.find((n) => n.id === 0)!.integridad);
    await montarObjeto(page, tipo);
    await page.waitForFunction((t) => (window.__debug.efectosVisibles ?? []).some((e) => e.tipo === `evento-${t}`), tipo, { timeout: 10000, polling: "raf" });
    const cuerpo = await page.evaluate((t) => {
      const objeto = window.__debug.objetos!.find((o) => o.tipo === t)!;
      const e = (window.__debug.efectosVisibles ?? []).find((x) => x.tipo === `evento-${t}` && x.nave === undefined)!;
      return { dx: Math.hypot(e.x - objeto.x, e.y - objeto.y), ruta: objeto.rutaPrevista.length };
    }, tipo);
    expect(cuerpo.dx).toBeLessThanOrEqual(5);
    expect(cuerpo.ruta).toBeGreaterThanOrEqual(10);
    await page.screenshot({ path: `capturas/bug-efectos-visibles-10-${tipo}-antes-360x640.png` });
    await page.evaluate((t) => {
      const w = window as unknown as { __vistos: { nave?: number; valor?: number }[] };
      w.__vistos = [];
      setInterval(() => {
        for (const e of window.__debug.efectosVisibles ?? []) if (e.tipo === `evento-${t}` && e.nave === 0 && w.__vistos.length === 0) w.__vistos.push({ nave: e.nave });
      }, 16);
    }, tipo);
    await page.getByTestId("disparar").click();
    await page.waitForFunction(() => ((window as unknown as { __vistos: unknown[] }).__vistos ?? []).length > 0, undefined, { timeout: 200000, polling: "raf" });
    await page.screenshot({ path: `capturas/bug-efectos-visibles-10-${tipo}-aplicado-360x640.png` });
    const alcance = await page.evaluate(() => window.__debug.ultimosEventos?.find((e) => e.tipo === "objeto-alcanza") ?? null);
    expect(alcance).toMatchObject({ objeto: tipo, nave: 0 });
    const integridadDespues = await page.evaluate(() => window.__debug.naves!.find((n) => n.id === 0)!.integridad);
    if (tipo === "corazon") expect(integridadDespues).toBeGreaterThanOrEqual(integridadAntes);
    else expect(integridadDespues).toBeLessThan(integridadAntes);
  });
}

// vis-4: con movimiento reducido siguen apareciendo, sin sacudir la cámara.
test.describe("vis-4: movimiento reducido", () => {
  test.use({ reducedMotion: "reduce" });
  for (const tipo of ["virus", "terremoto", "viento-solar"] as const) {
    test(`vis-4: ${tipo} sigue visible y la cámara no se sacude (360x640)`, async ({ page }) => {
      test.setTimeout(120000);
      await abrir(page, 360, 640);
      const sacudidas = await page.evaluate(() => window.__debug.sacudidasCamara ?? 0);
      await page.evaluate((t) => window.__debug.forzarEvento!(t, 1), tipo);
      await page.waitForFunction((t) => (window.__debug.efectosVisibles ?? []).some((e) => e.tipo === `evento-${t}`), tipo, { timeout: 10000, polling: "raf" });
      await page.screenshot({ path: `capturas/bug-efectos-visibles-10-reducido-${tipo}-360x640.png` });
      expect(await page.evaluate(() => window.__debug.sacudidasCamara ?? 0)).toBe(sacudidas);
    });
  }
  test("vis-4: el corazón sigue visible con movimiento reducido (360x640)", async ({ page }) => {
    test.setTimeout(120000);
    await abrir(page, 360, 640);
    await montarObjeto(page, "corazon");
    await page.waitForFunction(() => (window.__debug.efectosVisibles ?? []).some((e) => e.tipo === "evento-corazon"), undefined, { timeout: 10000, polling: "raf" });
    await page.screenshot({ path: "capturas/bug-efectos-visibles-10-reducido-corazon-360x640.png" });
  });
});
