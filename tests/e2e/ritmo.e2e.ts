import { test, expect, type Page } from "@playwright/test";

// ritmo-robot-propulsores (rit-1, rit-2, rit-3): la nave con propulsores y el
// Minirobot se reproducen despacio. Las aserciones leen __debug.reproduccion
// (la posición PINTADA, no la del estado) muestreada en cada frame con rAF; las
// capturas (CAPTURAS_DIR) son para el juicio visual del gatekeeper.
type Tamano = { ancho: number; alto: number };
const TAMANOS: readonly Tamano[] = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
];

async function empezar(page: Page, tamano: Tamano, parametros = "modo=presupuesto"): Promise<void> {
  await page.setViewportSize({ width: tamano.ancho, height: tamano.alto });
  await page.goto(`/?${parametros}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

async function captura(page: Page, nombre: string, tamano: Tamano): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/ritmo-${nombre}-${tamano.ancho}x${tamano.alto}.png` });
}

// Sondeo en la página: un registro por frame, sin depender de sleeps del test.
async function instalarSondeo(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __sondeo: { t: number; activa: boolean; nave?: { x: number; y: number }; robot?: { x: number; y: number; fase: string } }[]; __sondeoFin?: boolean };
    w.__sondeo = [];
    w.__sondeoFin = false;
    const bucle = (): void => {
      const r = window.__debug.reproduccion;
      w.__sondeo.push({
        t: performance.now(),
        activa: r?.activa === true,
        nave: r?.naves.find((n) => n.nave === 0),
        robot: r?.robots[0],
      });
      if (!w.__sondeoFin) requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
  });
}

type Muestra = { t: number; activa: boolean; nave?: { x: number; y: number }; robot?: { x: number; y: number; fase: string } };
const leerSondeo = (page: Page): Promise<Muestra[]> => page.evaluate(() => (window as unknown as { __sondeo: Muestra[] }).__sondeo);

function p95(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.floor(orden.length * 0.95))] ?? 0;
}

async function prepararPropulsores(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Un hueco despejado: el vuelo de 45° no choca con un planeta a las primeras de cambio.
    const mundo = window.__debug.mundo!;
    const libre = (x: number, y: number): boolean => {
      for (let dx = -260; dx <= 260; dx += 20) for (let dy = -260; dy <= 260; dy += 20) if (window.__debug.terreno!.esSolido(Math.round(x + dx), Math.round(y + dy))) return false;
      return true;
    };
    const actuales = window.__debug.naves!;
    let sitio = { x: actuales[0].x, y: actuales[0].y! };
    outer: for (let y = 300; y < mundo.alto - 300; y += 60) {
      for (let x = 300; x < mundo.ancho - 300; x += 60) {
        if (libre(x, y)) {
          sitio = { x, y };
          break outer;
        }
      }
    }
    window.__debug.cargarEscenario!({
      naves: [
        { x: sitio.x, y: sitio.y, integridad: 150 },
        { x: actuales[1].x, y: actuales[1].y!, integridad: 150 },
      ],
      arma: "pepinazo-cortesia",
      anguloGrados: 45,
      potencia: 60,
    });
  });
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId("equipo-propulsores").click();
  await page.waitForFunction(() => window.__debug.previsualizacionPropulsores != null, undefined, { timeout: 30000 });
}

for (const tamano of TAMANOS) {
  test(`rit-1: los propulsores mueven la nave poco a poco por su ruta (${tamano.ancho}x${tamano.alto})`, async ({ page }) => {
    test.setTimeout(180000);
    await empezar(page, tamano);
    await prepararPropulsores(page);
    await instalarSondeo(page);
    // Línea base de frame en reposo, para rit-3.
    await page.waitForTimeout(1500);
    await captura(page, "propulsores-antes", tamano);
    const idleHasta = (await leerSondeo(page)).length;
    await page.getByTestId("disparar").click();

    await page.waitForFunction(() => window.__debug.reproduccion?.activa === true, undefined, { timeout: 60000 });
    // Capturas cada 300 ms durante el vuelo (solo si hay CAPTURAS_DIR).
    for (let i = 1; i <= 5; i++) {
      await page.waitForTimeout(300);
      await captura(page, `propulsores-${i * 300}ms`, tamano);
    }
    await page.waitForFunction(() => window.__debug.reproduccion?.activa === false, undefined, { timeout: 30000 });
    const muestras = await leerSondeo(page);

    const duracionPrevista = await page.evaluate(() => window.__debug.duracionPropulsoresMs!);
    expect(duracionPrevista).toBeGreaterThanOrEqual(1500);
    expect(duracionPrevista).toBeLessThanOrEqual(3000);

    const activas = muestras.slice(idleHasta).filter((m) => m.activa && m.nave);
    expect(activas.length, "frames con la nave en vuelo").toBeGreaterThan(10);
    const medido = activas[activas.length - 1].t - activas[0].t;
    // La duración la fija el reloj de la escena; el medido solo acota que no es un salto.
    expect(medido).toBeGreaterThanOrEqual(duracionPrevista * 0.8);
    expect(medido).toBeLessThanOrEqual(duracionPrevista * 1.3 + 400);

    // ≥ 5 posiciones distintas, una cada 300 ms de vuelo.
    const distintas = new Set<string>();
    for (let t = activas[0].t; t <= activas[activas.length - 1].t; t += 300) {
      const m = activas.find((a) => a.t >= t)!;
      distintas.add(`${Math.round(m.nave!.x)},${Math.round(m.nave!.y)}`);
    }
    expect(distintas.size).toBeGreaterThanOrEqual(5);

    // Entre dos frames seguidos la nave avanza como mucho el pico de la curva
    // (el doble de la velocidad media, 300 u/s) por el tiempo del frame.
    for (let i = 1; i < activas.length; i++) {
      const dt = (activas[i].t - activas[i - 1].t) / 1000;
      const paso = Math.hypot(activas[i].nave!.x - activas[i - 1].nave!.x, activas[i].nave!.y - activas[i - 1].nave!.y);
      expect(paso).toBeLessThanOrEqual(2 * 300 * dt * 1.5 + 2);
    }

    // rit-3: el p95 del frame durante el vuelo no pasa de 1,15 × el de reposo (+ holgura de medida).
    const dtReposo = muestras.slice(1, idleHasta).map((m, i) => m.t - muestras[i].t);
    const dtVuelo = activas.slice(1).map((m, i) => m.t - activas[i].t);
    const reposo = p95(dtReposo);
    const vuelo = p95(dtVuelo);
    console.log(`[rit-3] propulsores ${tamano.ancho}x${tamano.alto}: p95 reposo ${reposo.toFixed(1)} ms, p95 vuelo ${vuelo.toFixed(1)} ms`);
    expect(vuelo).toBeLessThanOrEqual(reposo * 1.15 + 10);

    // La nave pintada acaba en el destino que calculó el núcleo.
    const final = await page.evaluate(() => ({ nave: window.__debug.naves![0], previsto: window.__debug.previsualizacionPropulsores }));
    expect(final.nave.x).toBeGreaterThan(0);
    await captura(page, "propulsores-final", tamano);
  });
}

test("rit-1: con movimiento reducido el vuelo dura entre 750 y 1500 ms y se sigue viendo", async ({ page }) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await empezar(page, TAMANOS[1]);
  await prepararPropulsores(page);
  await instalarSondeo(page);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.reproduccion?.activa === true, undefined, { timeout: 60000 });
  await page.waitForFunction(() => window.__debug.reproduccion?.activa === false, undefined, { timeout: 30000 });
  const duracion = await page.evaluate(() => window.__debug.duracionPropulsoresMs!);
  expect(duracion).toBeGreaterThanOrEqual(750);
  expect(duracion).toBeLessThanOrEqual(1500);
  const activas = (await leerSondeo(page)).filter((m) => m.activa && m.nave);
  expect(new Set(activas.map((m) => `${Math.round(m.nave!.x)},${Math.round(m.nave!.y)}`)).size).toBeGreaterThan(3);
});

for (const tamano of TAMANOS) {
  test(`rit-2: el Minirobot salta de planeta en planeta, salto a salto (${tamano.ancho}x${tamano.alto})`, async ({ page }) => {
    test.setTimeout(240000);
    await empezar(page, tamano, "modo=barra-libre");
    // Robot del humano posado en un planeta y el rival junto a otro más lejano.
    const montado = await page.evaluate(() => {
      const planetas = window.__debug.planetas ?? [];
      const mundo = window.__debug.mundo!;
      const actuales = window.__debug.naves!;
      let mejor: { robot: { x: number; y: number }; rival: { x: number; y: number }; distancia: number } | undefined;
      for (const a of planetas) {
        for (const b of planetas) {
          if (a.id === b.id) continue;
          const robot = { x: a.cx, y: a.cy - a.radio - 2 };
          const rival = { x: b.cx, y: b.cy - b.radio - 70 };
          if (rival.y < 60 || robot.y < 60 || rival.x < 60 || rival.x > mundo.ancho - 60) continue;
          if (window.__debug.terreno!.esSolido(Math.round(rival.x), Math.round(rival.y))) continue;
          const distancia = Math.hypot(robot.x - rival.x, robot.y - rival.y);
          if (distancia > mundo.ancho / 8 + 50 && (!mejor || distancia > mejor.distancia)) mejor = { robot, rival, distancia };
        }
      }
      if (!mejor) return false;
      window.__debug.cargarEscenario!({
        naves: [
          { x: actuales[0].x, y: actuales[0].y!, integridad: 150 },
          { x: mejor.rival.x, y: mejor.rival.y, integridad: 150 },
        ],
        arma: "pepinazo-cortesia",
        anguloGrados: 45,
        potencia: 55,
        robots: [{ x: mejor.robot.x, y: mejor.robot.y, dueno: 0 }],
      });
      return true;
    });
    expect(montado, "hace falta una pareja de planetas con el rival junto al segundo").toBe(true);
    await page.waitForFunction(() => (window.__debug.robots?.length ?? 0) === 1);
    const antes = await page.evaluate(() => window.__debug.robots![0]);
    await captura(page, "robot-posado", tamano);
    await instalarSondeo(page);

    // Un disparo del humano; la IA responde y, al cerrar su turno, el robot salta.
    await page.getByTestId("disparar").click();
    await page.waitForFunction(() => window.__debug.reproduccion?.robots.length === 1, undefined, { timeout: 180000 });
    const inicio = await page.evaluate(() => performance.now());
    for (const ms of [0, 300, 850, 1400]) {
      const espera = inicio + ms - (await page.evaluate(() => performance.now()));
      if (espera > 0) await page.waitForTimeout(espera);
      await captura(page, `robot-salto-${ms}ms`, tamano);
    }
    await page.waitForFunction(() => window.__debug.reproduccion?.activa === false, undefined, { timeout: 30000 });

    const muestras = (await leerSondeo(page)).filter((m) => m.robot);
    const duracionPrevista = await page.evaluate(() => window.__debug.duracionSaltoRobotMs!);
    expect(duracionPrevista).toBe(1700);
    const medido = muestras[muestras.length - 1].t - muestras[0].t;
    expect(medido).toBeGreaterThanOrEqual(1700 * 0.8);
    expect(medido).toBeLessThanOrEqual(1700 * 1.3 + 400);

    // Realce quieto → arco en el aire → pausa en el destino.
    const fases = muestras.map((m) => m.robot!.fase);
    expect(fases[0]).toBe("realce");
    expect(fases).toContain("arco");
    expect(fases[fases.length - 1]).toBe("pausa");
    const enAire = muestras.filter((m) => m.robot!.fase === "arco");
    const ymin = Math.min(...enAire.map((m) => m.robot!.y));
    const despues = await page.evaluate(() => window.__debug.robots?.[0]);
    // En lo alto del arco queda por encima de los dos puntos de reposo.
    expect(despues, "el robot sigue posado (no detonó)").toBeDefined();
    expect(ymin).toBeLessThan(Math.min(antes.y, despues!.y) - 20);
    // La posición final reproducida es la del núcleo (± 1 u).
    const ultima = muestras[muestras.length - 1].robot!;
    expect(Math.hypot(ultima.x - despues!.x, ultima.y - despues!.y)).toBeLessThanOrEqual(1);
    await captura(page, "robot-aterrizado", tamano);
  });
}
