import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";
import { arrastrarDesdeNave } from "./utilesApuntado";

// pc-1, pc-2, pc-3: una partida de la portada al final, como la jugaría una
// persona en el móvil y en el iPad. El mapa de planetas de siempre: el oráculo
// multipozo da la solución del tiro, así que los disparos dirigidos aciertan.
const LIMITE_MS = 200;
const VIEWPORTS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
];

interface Captura {
  readonly archivo: string;
  readonly que: string;
}

async function esperarJugable(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug.control?.puedeDisparar === true, undefined, { timeout: 120000 });
}

// El arma erratica (Mosca) puede no tener solución exacta: entonces vale un tiro cualquiera.
async function solucionDelTurno(page: Page): Promise<{ anguloGrados: number; potencia: number }> {
  const solucion = await page.evaluate(() => window.__debug.solucionMultipozoJugador!());
  return solucion ?? { anguloGrados: 45, potencia: 60 };
}

// Apunta con la solución exacta, dispara y espera a que el turno pase a la IA.
async function dispararConSolucion(page: Page): Promise<void> {
  await esperarJugable(page);
  const numeroTurno = await page.evaluate(() => window.__debug.numeroTurno!);
  const solucion = await solucionDelTurno(page);
  await arrastrarBarraHasta(page, "barra-angulo", (solucion.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS));
  await arrastrarBarraHasta(page, "barra-potencia", (solucion.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA));
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurno, { timeout: 120000 });
}

async function elegirArma(page: Page, armaId: string): Promise<void> {
  await esperarJugable(page);
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId(`arma-${armaId}`).click();
}

async function elegirEquipo(page: Page, equipoId: "escudo" | "propulsores"): Promise<void> {
  await esperarJugable(page);
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId(`equipo-${equipoId}`).click();
}

// La IA puede haber dañado al humano entre turnos: se le devuelve la
// integridad para que la partida llegue a sus momentos clave sin depender de la
// puntería de las IAs.
async function curarAlHumano(page: Page): Promise<void> {
  await page.evaluate(() => window.__debug.forzarIntegridad!(0, 100));
}

for (const vp of VIEWPORTS) {
  test(`pc-1/pc-2/pc-3: partida completa en ${vp.ancho}x${vp.alto} con CPU ×4`, async ({ page }) => {
    test.setTimeout(1500000);
    const dir = `test-results/partida-completa/${vp.ancho}x${vp.alto}`;
    mkdirSync(dir, { recursive: true });
    const capturas: Captura[] = [];
    const errores: string[] = [];
    page.on("pageerror", (error) => errores.push(error.message));

    const capturar = async (momento: string, que: string): Promise<void> => {
      const archivo = `${String(capturas.length + 1).padStart(2, "0")}-${momento}.png`;
      await page.screenshot({ path: `${dir}/${archivo}` });
      capturas.push({ archivo, que });
    };

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.setViewportSize({ width: vp.ancho, height: vp.alto });

    // 1. Portada y configuración: 1 humano frente a 2 IAs, en modo presupuesto.
    await page.goto("/");
    await capturar("portada", "Portada con el botón «Jugar» y la configuración de la partida.");
    await page.getByTestId("humanos-1").click();
    await page.getByTestId("ias-2").click();
    await page.getByTestId("modo-presupuesto").click();
    await expect(page.getByTestId("resumen-asientos")).toContainText("3 naves: 1 humano y 2 rivales de IA");
    await capturar("configuracion", "Configuración: un humano, dos rivales de IA y modo presupuesto elegido.");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(
      () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.rendimiento !== undefined,
      undefined,
      { timeout: 120000 },
    );
    if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
    await esperarJugable(page);

    const inicio = await page.evaluate(() => ({
      naves: window.__debug.naves!.length,
      controladores: window.__debug.controladores!,
      saldo: window.__debug.saldo,
      planetas: window.__debug.planetas?.length ?? 0,
      halos: window.__debug.halos?.length ?? 0,
      modo: window.__debug.motor?.modo,
    }));
    expect(inicio.naves).toBe(3);
    expect(inicio.controladores.map((c) => c.tipo)).toEqual(["humano", "ia", "ia"]);
    expect(inicio.saldo, "el saldo empieza en 600 créditos").toBe(600);
    expect(inicio.planetas).toBeGreaterThan(0);
    expect(inicio.halos, "un conjunto de halos por planeta").toBe(inicio.planetas);
    expect(inicio.modo).toBe("trabajador");
    const nombresIA = inicio.controladores.filter((c) => c.tipo === "ia").map((c) => c.nombre);
    await capturar("inicio-partida", "Tres naves de colores distintos, vidas con el color de su nave, halos de gravedad bajo los planetas y la consola abajo al 40 % del ancho.");

    // 2. Pepinazo dirigido: una explosión visible por detonación.
    await elegirArma(page, "pepinazo-cortesia");
    await dispararConSolucion(page);
    const pepinazo = await page.evaluate(() => ({ detonaciones: window.__debug.detonaciones?.length ?? 0, explosiones: (window.__debug.efectosVisibles ?? []).filter((e) => e.tipo === "explosion").length }));
    expect(pepinazo.detonaciones).toBeGreaterThan(0);
    expect(pepinazo.explosiones, "una explosión por cada detonación").toBeGreaterThanOrEqual(1);
    await capturar("pepinazo-impacto", "Explosión del Pepinazo en el punto de impacto, sin pantalla bloqueada.");

    // 3. Racimo: cinco perdigones juntos y el saldo baja con la compra.
    await curarAlHumano(page);
    await elegirArma(page, "racimo-de-tuppers");
    await capturar("racimo-en-reposo", "El Racimo de Tuppers elegido en el selector, con su dibujo propio.");
    const saldoAntes = (await page.evaluate(() => window.__debug.saldo)) as number;
    await dispararConSolucion(page);
    const racimo = await page.evaluate(() => ({ detonaciones: window.__debug.detonaciones ?? [], saldo: window.__debug.saldo as number }));
    expect(racimo.detonaciones.length, "el Racimo detona sus 5 perdigones").toBeGreaterThanOrEqual(5);
    expect(racimo.saldo, "el saldo baja con cada compra").toBeLessThan(saldoAntes);
    await capturar("racimo-perdigones", "Perdigones del Racimo estallando muy juntos, cerca del punto de impacto.");

    // 4. Misil con estela (Mosca Cojonera): su proyectil y su estela se ven en vuelo.
    await curarAlHumano(page);
    await elegirArma(page, "mosca-cojonera");
    const solucionMosca = await solucionDelTurno(page);
    await arrastrarBarraHasta(page, "barra-angulo", (solucionMosca.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS));
    await arrastrarBarraHasta(page, "barra-potencia", (solucionMosca.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA));
    const turnoMosca = await page.evaluate(() => window.__debug.numeroTurno!);
    await page.getByTestId("disparar").click();
    await page.waitForFunction(() => window.__debug.proyectilVisual != null, undefined, { timeout: 60000 });
    await page.waitForTimeout(300);
    const visual = await page.evaluate(() => window.__debug.proyectilVisual);
    expect(visual?.armaId).toBe("mosca-cojonera");
    await capturar("misil-en-vuelo", "El misil en vuelo con su dibujo propio y su estela, no un píxel.");
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turnoMosca, { timeout: 120000 });

    // 5. Tiro que se pierde: «¡Perdido!» y sin explosión.
    await curarAlHumano(page);
    await elegirArma(page, "pepinazo-cortesia");
    await arrastrarDesdeNave(page, 0, 90, 220);
    const turnoPerdido = await page.evaluate(() => window.__debug.numeroTurno!);
    await page.getByTestId("disparar").click();
    await page.waitForFunction(() => window.__debug.avisoPerdido !== undefined, undefined, { timeout: 60000 });
    const perdido = await page.evaluate(() => ({ detonaciones: window.__debug.detonaciones?.length ?? 0, borde: window.__debug.avisoPerdido!.borde }));
    expect(perdido.detonaciones, "un tiro perdido no detona").toBe(0);
    expect(perdido.borde).toBe("arriba");
    await capturar("tiro-perdido", "Aviso «¡Perdido!» junto al borde por el que salió el tiro.");
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turnoPerdido, { timeout: 60000 });

    // 6. Escudo en un turno y propulsores en otro: solo los propulsores y los impactos mueven naves.
    await curarAlHumano(page);
    await elegirEquipo(page, "escudo");
    const turnoEscudo = await page.evaluate(() => window.__debug.numeroTurno!);
    await capturar("escudo-elegido", "El escudo elegido en la pestaña de equipo.");
    await page.getByTestId("disparar").click();
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turnoEscudo, { timeout: 120000 });

    await curarAlHumano(page);
    await elegirEquipo(page, "propulsores");
    await arrastrarBarraHasta(page, "barra-angulo", 0);
    await arrastrarBarraHasta(page, "barra-potencia", 1);
    await page.waitForFunction(() => window.__debug.previsualizacionPropulsores != null, undefined, { timeout: 30000 });
    await capturar("propulsores-ruta", "Círculo de alcance y ruta prevista de los propulsores.");
    const turnoPropulsores = await page.evaluate(() => window.__debug.numeroTurno!);
    await page.getByTestId("disparar").click();
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turnoPropulsores, { timeout: 120000 });

    // 7. Minirobot: se queda posado y su contador se ve.
    await esperarJugable(page);
    await curarAlHumano(page);
    await elegirArma(page, "minirobot-saltaplanetas");
    const colocada = await page.evaluate(() => {
      const mundo = window.__debug.mundo!;
      const naves = window.__debug.naves ?? [];
      for (const planeta of window.__debug.planetas ?? []) {
        const x = planeta.cx;
        const y = planeta.cy - planeta.radio - 70;
        if (x < 80 || x > mundo.ancho - 80 || y < 80) continue;
        if (window.__debug.terreno!.esSolido(Math.round(x), Math.round(y))) continue;
        if (naves.some((nave) => nave.id !== 0 && Math.hypot(nave.x - x, (nave.y as number) - y) < 150)) continue;
        window.__debug.forzarPosicionNave!(0, x, y);
        return true;
      }
      return false;
    });
    if (colocada) {
      await arrastrarDesdeNave(page, 0, 270, 40);
      const turnoRobot = await page.evaluate(() => window.__debug.numeroTurno!);
      await page.getByTestId("disparar").click();
      await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turnoRobot, { timeout: 120000 });
      await page.waitForFunction(() => (window.__debug.robots?.length ?? 0) >= 1, undefined, { timeout: 30000 });
      await capturar("minirobot-posado", "El minirobot posado en el planeta con su contador de saltos.");
    } else {
      // Sin hueco sobre ningún planeta se dispara con la solución exacta: el robot igualmente sale.
      await dispararConSolucion(page);
    }

    // 8. Tres eventos del universo, cada uno con su efecto propio.
    for (const tipo of ["gravedad-x2", "agujero-negro", "tormenta"] as const) {
      await esperarJugable(page);
      const halosAntes = await page.evaluate(() => JSON.stringify(window.__debug.halos));
      await page.evaluate((t) => window.__debug.forzarEvento!(t, 1), tipo);
      await page.waitForFunction((t) => (window.__debug.efectosVisibles ?? []).some((e) => e.tipo === `evento-${t}`), tipo, { timeout: 30000 });
      if (tipo === "gravedad-x2") expect(await page.evaluate(() => JSON.stringify(window.__debug.halos)), "los halos crecen con gravedad-x2").not.toBe(halosAntes);
      if (tipo === "agujero-negro") expect(await page.evaluate(() => (window.__debug.halos ?? []).some((h) => h.id === 200))).toBe(true);
      await page.waitForTimeout(600);
      await capturar(`evento-${tipo}`, `Efecto gráfico propio del evento ${tipo}.`);
    }

    // 9. Consola: ocultar, comprobar que el lienzo queda libre, mostrar y mover.
    await esperarJugable(page);
    const cajaConsola = (await page.getByTestId("consola").boundingBox())!;
    const centro = { x: cajaConsola.x + cajaConsola.width / 2, y: cajaConsola.y + cajaConsola.height / 2 };
    await page.getByTestId("boton-ocultar-consola").click();
    await expect(page.getByTestId("pestana-consola")).toBeVisible();
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, centro), "la consola oculta deja el lienzo libre").toBe("CANVAS");
    expect(await page.evaluate(() => window.__debug.consola?.estado)).toBe("oculta");
    await capturar("consola-oculta", "Consola oculta: solo queda la pestaña de 48 × 48 y el lienzo libre.");
    await page.getByTestId("pestana-consola").click();
    await expect(page.getByTestId("disparar")).toBeVisible();
    await page.getByTestId("boton-mover-consola").click();
    await page.getByTestId("boton-mover-consola").click();
    expect(await page.evaluate(() => window.__debug.consola?.anclaje)).toBe("abajo-derecha");
    await capturar("consola-abajo-derecha", "Consola movida abajo a la derecha.");

    // 10. Histórico: se abre con mensajes, se lee y se cierra.
    await page.getByRole("button", { name: /Histórico/ }).click();
    await expect(page.getByTestId("historico-bromas-entrada-0")).toBeVisible();
    await capturar("historico", "Hoja del histórico con los mensajes agrupados por turno.");
    await page.getByTestId("historico-bromas-cerrar").click();
    await expect(page.getByTestId("historico-bromas-cerrar")).toBeHidden();

    // 11. Hasta el final: las IAs quedan a un impacto y se dispara con la solución exacta.
    await curarAlHumano(page);
    await page.evaluate(() => {
      window.__debug.forzarIntegridad!(1, 1);
      window.__debug.forzarIntegridad!(2, 1);
    });
    await elegirArma(page, "pepinazo-cortesia");
    let tiros = 0;
    while ((await page.evaluate(() => window.__debug.ganador)) === undefined && tiros < 8) {
      tiros++;
      await dispararConSolucion(page).catch(async () => {
        // Si la partida acabó con el disparo, ya no hay turno que esperar.
        expect(await page.evaluate(() => window.__debug.ganador)).not.toBeUndefined();
      });
      if ((await page.evaluate(() => (window.__debug.fantasmasNave ?? []).length)) === 1 && !capturas.some((c) => c.archivo.endsWith("fantasma.png"))) {
        await capturar("fantasma", "La IA caída se convierte en un fantasma translúcido con su nombre.");
      }
      if ((await page.evaluate(() => window.__debug.ganador)) === undefined) {
        await curarAlHumano(page);
        await page.evaluate(() => {
          for (const id of [1, 2]) if (!(window.__debug.eliminadas ?? []).includes(id)) window.__debug.forzarIntegridad!(id, 1);
        });
      }
    }
    await page.waitForFunction(() => window.__debug.ganador !== undefined, undefined, { timeout: 120000 });
    const fantasmas = await page.evaluate(() => window.__debug.fantasmasNave ?? []);
    expect(fantasmas.length, "cada IA muerta deja su fantasma").toBeGreaterThanOrEqual(1);
    for (const fantasma of fantasmas) expect(nombresIA).toContain(fantasma.nombre);
    expect(await page.evaluate(() => window.__debug.ganador)).toBe(0);
    await expect(page.getByTestId("ganador-nombre")).toHaveText("¡Has ganado!");
    await capturar("final", "Pantalla final con el título «¡Has ganado!».");

    // pc-3: el índice dice qué debe verse en cada captura.
    expect(capturas.length, "al menos 14 capturas con nombre").toBeGreaterThanOrEqual(14);
    writeFileSync(
      `${dir}/indice.md`,
      `# Partida completa ${vp.ancho}x${vp.alto}\n\n${capturas.map((c) => `- \`${c.archivo}\`: ${c.que}`).join("\n")}\n`,
    );

    // pc-2: ningún toque esperó a trabajo del juego de más de 200 ms.
    await page.waitForFunction(
      () => window.__debug.rendimiento!.interacciones.every((i) => i.trabajoApp !== null),
      undefined,
      { timeout: 30000 },
    );
    const medida = await page.evaluate(() => ({
      interacciones: window.__debug.rendimiento!.interacciones,
      inp: window.__debug.rendimiento!.inp,
      base: window.__debug.rendimiento!.baseMaquetacion,
    }));
    writeFileSync(
      `${dir}/respuesta.json`,
      JSON.stringify(
        {
          inp: medida.inp,
          baseMaquetacion: medida.base,
          interacciones: medida.interacciones.map(({ tipo, objetivo, trabajoApp, duracion, retrasoEntrada, renderLienzo }) => ({ tipo, objetivo, trabajoApp, duracion, retrasoEntrada, renderLienzo })),
        },
        null,
        1,
      ),
    );
    expect(errores, "ningún error de la página durante la partida").toEqual([]);
    expect(medida.interacciones.length, "interacciones registradas").toBeGreaterThanOrEqual(40);
    const lentas = medida.interacciones.filter((i) => (i.trabajoApp ?? 0) > LIMITE_MS);
    const peor = [...medida.interacciones].sort((x, y) => (y.trabajoApp ?? 0) - (x.trabajoApp ?? 0)).slice(0, 5);
    const resumen = peor.map((i) => `${i.objetivo.slice(0, 18)} ${i.tipo[0]} app=${Math.round(i.trabajoApp ?? 0)} dur=${Math.round(i.duracion)}`).join(" | ");
    expect(lentas.length, `base=${Math.round(medida.base)} ${resumen}`).toBe(0);
  });
}
