import { test, expect, type Page } from "@playwright/test";
import { pulsarAjuste } from "./utilesControl";

// remate-impacto (rem-1..rem-7): el golpe decisivo hace destello, pausa,
// acercamiento y vuelta; con movimiento reducido o «Sacudida» apagada solo
// destello. Nada espera tiempos fijos: se muestrea el estado de la escena.
async function capturar(page: Page, nombre: string): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nombre}.png` });
}

async function empezar(page: Page, ancho = 360, alto = 640): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto("/?modo=barra-libre");
  await page.getByTestId("ias-2").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// Deja a un rival con integridad 5 y aplica un tiro que hace daño. Los planetas
// del mundo cambian de una partida a otra: si desde una colocación el oráculo no
// ve ningún tiro, se prueba la siguiente en vez de fallar por la geometría.
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

// Tras cargarEscenario la cámara reencuadra por su cuenta (las naves cambian de
// sitio y puede quedar alguna bajo la consola); se espera a que deje de moverse
// antes de tomar la referencia, para no confundir ese reencuadre con el remate.
async function esperarCamaraQuieta(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __camPrev?: string; __camQuietos?: number };
      const actual = JSON.stringify(window.__debug.camara);
      w.__camQuietos = actual === w.__camPrev ? (w.__camQuietos ?? 0) + 1 : 0;
      w.__camPrev = actual;
      return w.__camQuietos >= 10;
    },
    undefined,
    { timeout: 30000, polling: "raf" },
  );
}

interface Muestra {
  activo: boolean;
  puedeDisparar: boolean;
  turno: number;
  sacudidas: number;
  camara: { x: number; y: number; ancho: number; alto: number };
}

async function dispararYMuestrear(page: Page, capturaEnZoom?: string, capturaDestello?: string): Promise<Muestra[]> {
  await page.evaluate(() => {
    const w = window as unknown as { __muestras: unknown[]; __parar: boolean };
    w.__muestras = [];
    w.__parar = false;
    const tick = (): void => {
      const d = window.__debug;
      w.__muestras.push({
        activo: d.remate!.activo,
        puedeDisparar: d.control!.puedeDisparar,
        turno: d.turno,
        sacudidas: d.sacudidasCamara ?? 0,
        camara: { ...d.camara! },
      });
      if (!w.__parar) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const antes = await page.evaluate(() => window.__debug.remate!.completados);
  await page.getByTestId("disparar").click();
  if (capturaDestello) {
    // Mejor esfuerzo, como la del zoom: el destello dura 150 ms y con el lienzo por software puede no verse.
    const hayDestello = await page.waitForFunction(() => window.__debug.remate!.activo, undefined, { timeout: 90000, polling: "raf" }).then(() => true, () => false);
    if (hayDestello) await capturar(page, capturaDestello);
  }
  if (capturaEnZoom) {
    // Mejor esfuerzo: la captura sirve de evidencia visual, no de aserción.
    const ancho0 = (await page.evaluate(() => window.__debug.camara!.ancho)) - 1;
    const enZoom = await page.waitForFunction((a) => window.__debug.remate!.activo && window.__debug.camara!.ancho < a, ancho0, { timeout: 90000, polling: "raf" }).then(() => true, () => false);
    if (enZoom) await capturar(page, capturaEnZoom);
  }
  await page.waitForFunction((c) => window.__debug.remate!.completados > c, antes, { timeout: 90000 });
  await page.waitForFunction(() => !window.__debug.remate!.activo, undefined, { timeout: 30000 });
  return page.evaluate(() => {
    const w = window as unknown as { __muestras: Muestra[]; __parar: boolean };
    w.__parar = true;
    return w.__muestras;
  });
}

for (const { ancho, alto } of [{ ancho: 360, alto: 640 }, { ancho: 820, alto: 1180 }, { ancho: 1180, alto: 820 }]) {
test(`rem-1, rem-2, rem-4: remate completo con fases en orden, entradas bloqueadas y encuadre restaurado (${ancho}x${alto})`, async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page, ancho, alto);
  await prepararGolpe(page);
  await esperarCamaraQuieta(page);
  const camaraAntes = await page.evaluate(() => ({ ...window.__debug.camara! }));
  await capturar(page, `remate-impacto-rem-2-antes-${ancho}x${alto}`);
  const turno0 = await page.evaluate(() => window.__debug.turno);
  const muestras = await dispararYMuestrear(page, `remate-impacto-rem-1-acercamiento-${ancho}x${alto}`, `remate-impacto-rem-1-destello-${ancho}x${alto}`);
  const remate = await page.evaluate(() => window.__debug.remate!);
  expect(remate.ultimo!.modo).toBe("completo");
  expect(remate.ultimo!.fases.map((f) => f.nombre)).toEqual(["destello", "pausa", "acercamiento", "sosten", "vuelta"]);
  expect(remate.ultimo!.duracionMs).toBeLessThanOrEqual(800);
  const pausa = remate.ultimo!.fases.find((f) => f.nombre === "pausa")!;
  expect(pausa.finMs - pausa.inicioMs).toBe(200);
  const activas = muestras.filter((m) => m.activo);
  expect(activas.length).toBeGreaterThan(0);
  for (const m of activas) {
    expect(m.puedeDisparar, "entradas bloqueadas durante el remate").toBe(false);
    expect(m.turno, "el turno no avanza hasta que acaba el remate").toBe(turno0);
  }
  expect(activas.some((m) => m.camara.ancho < camaraAntes.ancho - 1), "la cámara se acerca").toBe(true);
  expect(remate.destellosCamara.length).toBe(1);
  // El destello (k = 0) no mueve la cámara: parte del encuadre real de antes, no
  // de un zoom 1 absoluto con el desplazamiento de la consola aplicado dos veces.
  for (const k of ["x", "y", "ancho", "alto"] as const) expect(Math.abs(activas[0].camara[k] - camaraAntes[k]), `primer fotograma del remate, ${k}`).toBeLessThanOrEqual(0.5);
  // El remate devuelve la cámara y, en el mismo fotograma, el turno avanza y el
  // encuadre preferido se recalcula (la consola se aparta con el turno del rival),
  // así que ya no tiene que coincidir con el de antes: tiene que ser el automático,
  // válido y sin el acercamiento del remate.
  await expect.poll(() => page.evaluate(() => window.__debug.zonasCamara!().zoom), { timeout: 20000 }).toBeLessThanOrEqual(1);
  const zonas = await page.evaluate(() => window.__debug.zonasCamara!());
  expect(zonas.modo).toBe("auto");
  expect(zonas.valido, JSON.stringify(zonas)).toBe(true);
  await capturar(page, `remate-impacto-rem-2-despues-${ancho}x${alto}`);
});
}

test("rem-3: con movimiento reducido el remate es solo un destello", async ({ page }) => {
  test.setTimeout(240000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await empezar(page);
  await prepararGolpe(page);
  await esperarCamaraQuieta(page);
  const camaraAntes = await page.evaluate(() => ({ ...window.__debug.camara! }));
  const turnoAntes = await page.evaluate(() => window.__debug.turno);
  const sacudidasAntes = await page.evaluate(() => window.__debug.sacudidasCamara ?? 0);
  const muestras = await dispararYMuestrear(page);
  const remate = await page.evaluate(() => window.__debug.remate!);
  expect(remate.ultimo!.modo).toBe("destello");
  expect(remate.ultimo!.duracionMs).toBeLessThanOrEqual(150);
  expect(remate.destellosCamara.length).toBe(1);
  // Solo cuenta hasta el final del destello: después la cámara recalcula su
  // encuadre preferido para el turno siguiente (zonas del HUD) y eso no es del remate.
  const delTurno = muestras.slice(0, muestras.map((m) => m.activo).lastIndexOf(true) + 1).filter((x) => x.turno === turnoAntes);
  const desviadas = delTurno.map((m, i) => ({ i, a: Math.round(m.camara.ancho), r: m.activo ? 1 : 0, p: m.puedeDisparar ? 1 : 0 })).filter((m) => m.a !== Math.round(camaraAntes.ancho));
  expect(desviadas.length, `n=${delTurno.length} antes=${Math.round(camaraAntes.ancho)} ${JSON.stringify(desviadas.slice(0, 3))}`).toBe(0);
  for (const m of delTurno) expect(m.sacudidas).toBe(sacudidasAntes);
  await capturar(page, "remate-impacto-rem-3-reducido-360x640");
});

test("rem-3: con «Sacudida» apagada el remate es solo un destello", async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page);
  await pulsarAjuste(page, "toggle-sacudida");
  await prepararGolpe(page);
  await esperarCamaraQuieta(page);
  const camaraAntes = await page.evaluate(() => ({ ...window.__debug.camara! }));
  const turnoAntes = await page.evaluate(() => window.__debug.turno);
  const muestras = await dispararYMuestrear(page);
  const remate = await page.evaluate(() => window.__debug.remate!);
  expect(remate.ultimo!.modo).toBe("destello");
  // Solo cuenta hasta el final del destello: después la cámara recalcula su
  // encuadre para el turno siguiente, con transición, y eso no es del remate.
  const hastaRemate = muestras.slice(0, muestras.map((m) => m.activo).lastIndexOf(true) + 1);
  const desviadas = hastaRemate
    .map((m, i) => ({ i, a: Math.round(m.camara.ancho), r: m.activo ? 1 : 0, p: m.puedeDisparar ? 1 : 0, t: m.turno }))
    .filter((m) => m.t === turnoAntes && m.a !== Math.round(camaraAntes.ancho));
  expect(desviadas.length, `n=${hastaRemate.length} ${JSON.stringify(desviadas.slice(0, 2))}`).toBe(0);
  expect(await page.evaluate(() => window.__debug.sacudidasCamara ?? 0)).toBe(0);
});

test("rem-5: un impacto sin muerte no hace remate y conserva la sacudida de siempre", async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page);
  const antes = await page.evaluate(() => window.__debug.remate!.completados);
  await page.evaluate(() => {
    const n = window.__debug.naves!.find((v) => v.id === 1)!;
    window.__debug.dispararEventoImpactoReal!(1, n.x, n.y, 20);
  });
  const d = await page.evaluate(() => ({ completados: window.__debug.remate!.completados, realce: window.__debug.ultimoRealceImpacto }));
  expect(d.completados).toBe(antes);
  expect(d.realce?.danio).toBe(20);
});
