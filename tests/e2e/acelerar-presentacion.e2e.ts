import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// acelerar-presentacion: vel-1, vel-2, vel-3, vel-4 y vel-6. Se juega por la
// portada real, en el mapa sembrado de siempre y contra una IA.
const MAPA_SEMBRADO = "calma-de-los-restos";
const CLAVE = "presentacion:animaciones-rapidas";
const TAMANOS = [
  { w: 360, h: 640 },
  { w: 820, h: 1180 },
  { w: 1180, h: 820 },
];

async function empezar(page: Page, tam: { w: number; h: number }, opciones: { rapidas?: string; query?: string } = {}): Promise<void> {
  if (opciones.rapidas !== undefined) {
    const valor = opciones.rapidas;
    await page.addInitScript(([clave, v]) => window.localStorage.setItem(clave, v), [CLAVE, valor]);
  }
  await page.setViewportSize({ width: tam.w, height: tam.h });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}${opciones.query ?? ""}`);
  await page.getByTestId("humanos-1").click();
  await page.getByTestId("ias-1").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  mkdirSync("capturas", { recursive: true });
}

async function esperarFase(page: Page, fase: string): Promise<void> {
  await page.waitForFunction((f) => window.__debug.velocidadPresentacion!().fase === f, fase, { timeout: 60000, polling: "raf" });
}

for (const t of TAMANOS) {
  test(`vel-1: «⏩» durante el vuelo, «×3» tras el toque y fuera del DOM tras el impacto (${t.w}x${t.h})`, async ({ page }) => {
    test.setTimeout(180000);
    await empezar(page, t);
    await expect(page.getByTestId("boton-acelerar")).toHaveCount(0);
    await page.evaluate(() => window.__debug.fijarApuntado!(40, 60));
    await page.getByTestId("disparar").click();
    await esperarFase(page, "vuelo");
    const boton = page.getByTestId("boton-acelerar");
    await expect(boton).toHaveText("⏩");
    expect(await page.evaluate(() => window.__debug.velocidadPresentacion!().factor)).toBe(1);
    const caja = await boton.boundingBox();
    expect(caja!.width).toBeGreaterThanOrEqual(48);
    expect(caja!.height).toBeGreaterThanOrEqual(48);
    // Ni la consola ni el ⚙ quedan tapados por el botón (zonas que publica el HUD).
    const choques = await page.evaluate(() => {
      const zonas = window.__debug.zonasCamara!().zonas;
      const a = zonas.find((z) => z.id === "acelerar");
      if (a === undefined) return ["sin zona acelerar"];
      return zonas
        .filter((z) => z.id !== "acelerar" && z.visible)
        .filter((z) => a.x < z.x + z.ancho && z.x < a.x + a.ancho && a.y < z.y + z.alto && z.y < a.y + a.alto)
        .map((z) => z.id);
    });
    expect(choques).toEqual([]);
    await page.screenshot({ path: `capturas/acelerar-presentacion-1-antes-${t.w}x${t.h}.png` });

    const ajusteAntes = await page.evaluate(() => window.__debug.control!.ajuste);
    await boton.click();
    await expect(boton).toHaveText("×3");
    expect(await page.evaluate(() => window.__debug.control!.ajuste)).toEqual(ajusteAntes);
    const tras = await page.evaluate(() => window.__debug.velocidadPresentacion!());
    expect(tras.factor).toBe(3);
    expect(tras.origen).toBe("toque");
    await page.screenshot({ path: `capturas/acelerar-presentacion-1-despues-${t.w}x${t.h}.png` });
    await page.waitForFunction(() => (window.__debug.latencias!().some((l) => l.nombre === "acelerar")), undefined, { timeout: 10000 });
    const medida = await page.evaluate(() => window.__debug.latencias!().findLast((l) => l.nombre === "acelerar")!.ms);
    expect(medida).toBeLessThanOrEqual(200);

    await page.waitForFunction(() => window.__debug.velocidadPresentacion!().fase !== "vuelo", undefined, { timeout: 60000, polling: "raf" });
    const fin = await page.evaluate(() => window.__debug.velocidadPresentacion!());
    expect(fin.factor).toBe(1);
    if (fin.fase === "post-impacto") await expect(boton).toHaveCount(0);
  });
}

test("vel-1: un toque en el lienzo durante el turno de la IA acelera y no cambia el apuntado", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page, TAMANOS[0]);
  await page.evaluate(() => window.__debug.fijarApuntado!(40, 60));
  await page.getByTestId("disparar").click();
  await esperarFase(page, "turno-ia");
  const ajuste = await page.evaluate(() => window.__debug.control!.ajuste);
  await expect(page.getByTestId("boton-acelerar")).toHaveText("⏩");
  await page.mouse.click(180, 300);
  expect(await page.evaluate(() => window.__debug.velocidadPresentacion!().factor)).toBe(3);
  await expect(page.getByTestId("boton-acelerar")).toHaveText("×3");
  expect(await page.evaluate(() => window.__debug.control!.ajuste)).toEqual(ajuste);
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 120000 });
  await expect(page.getByTestId("boton-acelerar")).toHaveCount(0);
});

async function disparoEscenario(page: Page, acelerar: boolean) {
  await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    window.__debug.cargarEscenario!({
      naves: [
        { x: 120, y: mundo.alto / 2, integridad: 150 },
        { x: mundo.ancho - 120, y: mundo.alto / 2, integridad: 150 },
      ],
      arma: "mosca-cojonera",
      anguloGrados: 40,
      potencia: 70,
    });
  });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  // La respuesta de la IA encadena sin un fotograma de por medio y pisa
  // trayectoriaAnimadaUltimoVuelo: se guarda la primera escritura, la del
  // disparo humano (misma trampa que mos-3).
  await page.evaluate(() => {
    const debug = window.__debug as unknown as { _tray?: unknown };
    let capturado = false;
    Object.defineProperty(window.__debug, "trayectoriaAnimadaUltimoVuelo", {
      configurable: true,
      get: () => debug._tray,
      set(v) {
        debug._tray = v;
        if (capturado) return;
        capturado = true;
        (window as unknown as { __vel2: unknown }).__vel2 = {
          trayectoria: (v as { x: number; y: number }[]).map((p) => ({ x: p.x, y: p.y })),
          impacto: window.__debug.ultimoDisparo!.impactoReal,
        };
      },
    });
  });
  await page.getByTestId("disparar").click();
  if (acelerar) {
    await esperarFase(page, "vuelo");
    await page.getByTestId("boton-acelerar").click();
    expect(await page.evaluate(() => window.__debug.velocidadPresentacion!().factor)).toBe(3);
  }
  await page.waitForFunction(() => (window as unknown as { __vel2?: unknown }).__vel2 !== undefined, undefined, { timeout: 60000, polling: "raf" });
  const vuelo = await page.evaluate(() => (window as unknown as { __vel2: { trayectoria: { x: number; y: number }[]; impacto: { x: number; y: number } } }).__vel2);
  // Integridades al volver el turno al humano: incluyen el cierre y la respuesta de la IA.
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 120000 });
  const integridades = await page.evaluate(() => window.__debug.naves!.map((n) => n.integridad));
  return { ...vuelo, integridades };
}

test("vel-2: el mismo disparo a ×1 y a ×3 da la misma trayectoria, impacto e integridades", async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page, TAMANOS[1]);
  const lento = await disparoEscenario(page, false);
  await empezar(page, TAMANOS[1]);
  const rapido = await disparoEscenario(page, true);
  expect(rapido.trayectoria.length).toBe(lento.trayectoria.length);
  rapido.trayectoria.forEach((p, i) => {
    expect(Math.abs(p.x - lento.trayectoria[i].x)).toBeLessThan(1e-9);
    expect(Math.abs(p.y - lento.trayectoria[i].y)).toBeLessThan(1e-9);
  });
  expect(rapido.impacto).toEqual(lento.impacto);
  expect(rapido.integridades).toEqual(lento.integridades);
});

// Golpe decisivo real (barra libre, 3 naves, rival a 5 de integridad): el
// remate solo existe en el camino de disparo de verdad.
async function prepararGolpe(page: Page): Promise<void> {
  const colocaciones = [
    { xj: 0.2, yj: 0.5, xd: 0.8, yd: 0.3, xo: 0.8, yo: 0.7 },
    { xj: 0.15, yj: 0.7, xd: 0.7, yd: 0.2, xo: 0.85, yo: 0.8 },
    { xj: 0.25, yj: 0.3, xd: 0.75, yd: 0.6, xo: 0.9, yo: 0.2 },
    { xj: 0.1, yj: 0.5, xd: 0.5, yd: 0.15, xo: 0.9, yo: 0.85 },
    { xj: 0.3, yj: 0.8, xd: 0.6, yd: 0.5, xo: 0.9, yo: 0.5 },
  ];
  let solucion: { anguloGrados: number; potencia: number } | null = null;
  for (const c of colocaciones) {
    await page.evaluate((c) => {
      const mundo = window.__debug.mundo!;
      window.__debug.cargarEscenario!({
        naves: [
          { x: mundo.ancho * c.xj, y: mundo.alto * c.yj, integridad: 150 },
          { x: mundo.ancho * c.xd, y: mundo.alto * c.yd, integridad: 5 },
          { x: mundo.ancho * c.xo, y: mundo.alto * c.yo, integridad: 150 },
        ],
        arma: "pepinazo-cortesia",
        anguloGrados: 45,
        potencia: 60,
      });
    }, c);
    solucion = await page.evaluate(() => window.__debug.solucionMultipozoJugador!());
    if (solucion) break;
  }
  expect(solucion, "hay un tiro con daño para el golpe decisivo").not.toBeNull();
  await page.evaluate((s) => window.__debug.fijarApuntado!(s!.anguloGrados, s!.potencia), solucion);
}

test("vel-3: con el ajuste activo el remate dura lo que dura su plan y el botón no aparece", async ({ page }) => {
  test.setTimeout(240000);
  await page.addInitScript(([clave]) => window.localStorage.setItem(clave, "1"), [CLAVE]);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?modo=barra-libre");
  await page.getByTestId("ias-2").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await prepararGolpe(page);
  // Muestreo por fotograma de la fase, el factor y el botón mientras dura el remate.
  await page.evaluate(() => {
    const w = window as unknown as { __vel3: { fases: string[]; factores: number[]; botones: boolean[]; inicio: number | null; fin: number | null }; __parar: boolean };
    w.__vel3 = { fases: [], factores: [], botones: [], inicio: null, fin: null };
    const tick = (): void => {
      const r = window.__debug.remate!;
      const v = window.__debug.velocidadPresentacion!();
      if (r.activo) {
        w.__vel3.inicio ??= performance.now();
        w.__vel3.fases.push(v.fase);
        w.__vel3.factores.push(v.factor);
        w.__vel3.botones.push(v.botonVisible);
      } else if (w.__vel3.inicio !== null && w.__vel3.fin === null) w.__vel3.fin = performance.now();
      if (w.__vel3.fin === null) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByTestId("disparar").click();
  await esperarFase(page, "vuelo");
  expect((await page.evaluate(() => window.__debug.velocidadPresentacion!())).factor).toBe(3);
  await page.waitForFunction(() => (window as unknown as { __vel3: { fin: number | null } }).__vel3.fin !== null, undefined, { timeout: 120000, polling: "raf" });
  const m = await page.evaluate(() => ({
    ...(window as unknown as { __vel3: { fases: string[]; factores: number[]; botones: boolean[]; inicio: number; fin: number } }).__vel3,
    plan: window.__debug.remate!.ultimo!.duracionMs,
  }));
  expect(m.fases.length).toBeGreaterThan(0);
  expect(new Set(m.fases)).toEqual(new Set(["remate"]));
  expect(new Set(m.factores)).toEqual(new Set([1]));
  expect(new Set(m.botones)).toEqual(new Set([false]));
  // Un delta triplicado habría acabado el plan en un tercio de su duración.
  expect(m.fin - m.inicio).toBeGreaterThanOrEqual(m.plan * 0.9);
});

test("vel-4: «Animaciones rápidas» en ⚙ se guarda, el vuelo parte a ×3 y un valor corrupto cuenta como desactivado", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page, TAMANOS[0]);
  await page.getByTestId("boton-ajustes").click();
  const interruptor = page.getByTestId("toggle-animaciones-rapidas");
  await expect(interruptor).toContainText("Animaciones rápidas: No");
  await expect(page.getByText("Los vuelos y el turno de la IA se ven al triple. El resultado no cambia.")).toBeVisible();
  await interruptor.click();
  await expect(interruptor).toContainText("Animaciones rápidas: Sí");
  await page.screenshot({ path: "capturas/acelerar-presentacion-4-ajuste-360x640.png" });
  await page.getByTestId("cerrar-ajustes").click();
  expect(await page.evaluate((c) => window.localStorage.getItem(c), CLAVE)).toBe("1");

  // Otra carga de la página: el ajuste tiene que venir de localStorage.
  await empezar(page, TAMANOS[0]);
  await page.getByTestId("boton-ajustes").click();
  await expect(page.getByTestId("toggle-animaciones-rapidas")).toContainText("Animaciones rápidas: Sí");
  await page.getByTestId("cerrar-ajustes").click();
  await page.evaluate(() => window.__debug.fijarApuntado!(40, 60));
  await page.getByTestId("disparar").click();
  await esperarFase(page, "vuelo");
  await expect(page.getByTestId("boton-acelerar")).toHaveText("×3");
  expect(await page.evaluate(() => window.__debug.velocidadPresentacion!().origen)).toBe("ajuste");
});

test("vel-4: un valor basura en localStorage cuenta como desactivado", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, TAMANOS[0], { rapidas: "{no-es-un-booleano" });
  await page.getByTestId("boton-ajustes").click();
  await expect(page.getByTestId("toggle-animaciones-rapidas")).toContainText("Animaciones rápidas: No");
});

for (const t of TAMANOS) {
  test(`vel-6: el panel de ?rendimiento=1 muestra la fila «acelerar» (${t.w}x${t.h})`, async ({ page }) => {
    test.setTimeout(180000);
    await empezar(page, t, { query: "&rendimiento=1" });
    await page.evaluate(() => window.__debug.fijarApuntado!(40, 60));
    await page.getByTestId("disparar").click();
    await esperarFase(page, "vuelo");
    await page.getByTestId("boton-acelerar").click();
    await expect(page.getByText(/acelerar: \d+ ms/)).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `capturas/acelerar-presentacion-6-panel-${t.w}x${t.h}.png` });
  });
}
