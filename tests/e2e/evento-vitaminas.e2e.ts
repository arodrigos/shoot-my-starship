import { test, expect, type Page } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

async function empezar(page: Page, parametros: string): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?eventos=1&${parametros}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.fijarProximoEvento !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// evt-5, evt-6: el pronóstico cuenta los turnos que faltan, cabe en una línea y,
// un turno antes, dice qué evento llega y a quién.
test("pronóstico: cuenta atrás en una línea y, con 1 turno, nombra el evento y la nave", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, "modo=barra-libre");
  await page.evaluate(() => window.__debug.fijarProximoEvento!({ enTurnos: 3, tipo: "vitaminas", afectado: 0 }));
  const pronostico = page.getByTestId("pronostico");
  await expect(pronostico).toHaveText("Próximo evento en 3 turnos");
  expect(await pronostico.evaluate((nodo) => nodo.scrollWidth <= nodo.clientWidth)).toBe(true);

  await page.evaluate(() => window.__debug.fijarProximoEvento!({ enTurnos: 1, tipo: "vitaminas", afectado: 0 }));
  await expect(pronostico).toContainText("Próximo evento en 1 turno: Vitaminas artificiales");
  expect(await pronostico.evaluate((nodo) => nodo.scrollWidth <= nodo.clientWidth)).toBe(true);
  const proximo = await page.evaluate(() => window.__debug.proximoEvento);
  expect(proximo).toEqual({ enTurnos: 1, tipo: "vitaminas", afectado: 0 });
});

// evt-1, evt-6 de punta a punta: llega en el turno programado, se anuncia con
// un cartel pequeño que se va solo, y el efecto queda vivo con sus 3 turnos.
test("vitaminas: llega en el turno programado, se anuncia y deja el efecto con 3 turnos", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page, "modo=barra-libre");
  await page.evaluate(() => window.__debug.fijarProximoEvento!({ enTurnos: 1, tipo: "vitaminas", afectado: 0 }));
  // El cartel dura 2,5 s: se observa dentro de la página, con su propio reloj,
  // para que la latencia de Playwright entre llamadas no falsee la medida.
  await page.evaluate(() => {
    const registro: { texto: string; alto: number; desde: number; hasta: number | null; sonda: number | null } = { texto: "", alto: 0, desde: 0, hasta: null, sonda: null };
    (window as unknown as { __cartelRegistro: typeof registro }).__cartelRegistro = registro;
    new MutationObserver(() => {
      const nodo = document.querySelector('[data-testid="cartel-evento"]');
      if (nodo !== null && registro.desde === 0) {
        registro.desde = performance.now();
        registro.texto = nodo.textContent ?? "";
        registro.alto = nodo.getBoundingClientRect().height;
        // Sonda de 2,5 s armada a la vez que el cartel: en el CI el hilo
        // principal va cargado y todo temporizador llega tarde, así que se
        // mide cuánto después de la sonda se va el cartel, no el reloj de pared.
        window.setTimeout(() => { registro.sonda = performance.now(); }, 2500);
      } else if (nodo === null && registro.desde !== 0 && registro.hasta === null) {
        registro.hasta = performance.now();
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => (window as unknown as { __cartelRegistro: { hasta: number | null } }).__cartelRegistro.hasta !== null, undefined, { timeout: 90000 });
  const registro = await page.evaluate(() => (window as unknown as { __cartelRegistro: { texto: string; alto: number; desde: number; hasta: number; sonda: number | null } }).__cartelRegistro);
  expect(registro.texto).toContain("Vitaminas artificiales");
  expect(registro.alto).toBeLessThanOrEqual(56);
  expect(registro.hasta - registro.desde).toBeGreaterThanOrEqual(2200);
  // Un temporizador reiniciado por un cambio de identidad del cartel añadiría
  // segundos enteros tras la sonda; el retraso de la carga no.
  expect(registro.sonda).not.toBeNull();
  expect(registro.hasta - (registro.sonda ?? 0)).toBeLessThanOrEqual(300);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true && window.__debug.animacionEnCurso === false, undefined, { timeout: 60000 });
  const efectos = await page.evaluate(() => window.__debug.efectos);
  expect(efectos).toEqual([{ tipo: "vitaminas", nave: 0, turnosRestantes: 3 }]);
  // El calendario ya programó el siguiente, a 2-5 turnos de aquel.
  const proximo = await page.evaluate(() => window.__debug.proximoEvento!);
  expect(proximo.enTurnos).toBeGreaterThanOrEqual(1);
  expect(proximo.enTurnos).toBeLessThanOrEqual(5);
});

// evt-4: la celda de cada arma gratis avisa del riesgo.
test("armas gratis: la celda avisa de que puede provocar un evento", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, "modo=presupuesto");
  await page.getByTestId("selector-arma-abrir").click();
  await expect(page.getByTestId("gratis-evento-petardo-de-feria")).toContainText("25 % de provocar un evento");
});

// Un turno propio con la solución balística exacta contra el rival: devuelve
// lo que le bajó la integridad. El rival y el tirador se restauran antes para
// que cada medida parta de 100 y el calendario no pueda matar a nadie.
async function dispararYMedirDanio(page: Page): Promise<number> {
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true && window.__debug.animacionEnCurso === false, undefined, { timeout: 120000 }).catch(async (error: unknown) => {
    throw new Error(`antes de disparar, estado ${await volcarEstado(page)}`, { cause: error });
  });
  await page.evaluate(() => {
    window.__debug.forzarIntegridad!(0, 100);
    window.__debug.forzarIntegridad!(1, 100);
  });
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();
  await arrastrarBarraHasta(page, "barra-angulo", (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS));
  await arrastrarBarraHasta(page, "barra-potencia", (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA));
  const turnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  // aplicarResultadoTurno ya corrió cuando el contador avanza: la integridad
  // del rival es la de este disparo, antes de que responda la IA.
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, turnoAntes, { timeout: 120000 }).catch(async (error: unknown) => {
    throw new Error(`tras disparar (turno ${turnoAntes}), estado ${await volcarEstado(page)}`, { cause: error });
  });
  return 100 - (await page.evaluate(() => window.__debug.naves!.find((nave) => nave.id === 1)!.integridad));
}

async function volcarEstado(page: Page): Promise<string> {
  return JSON.stringify(
    await page.evaluate(() => ({
      efectos: window.__debug.efectos,
      animacionEnCurso: window.__debug.animacionEnCurso,
      puedeDisparar: window.__debug.control?.puedeDisparar,
      numeroTurno: window.__debug.numeroTurno,
      proximo: window.__debug.proximoEvento,
      naves: window.__debug.naves?.map((nave) => ({ id: nave.id, integridad: nave.integridad })),
    })),
  );
}

// El efecto se aplica al cerrar la ronda, tras la respuesta de la IA, y
// puedeDisparar puede valer true un instante antes: se espera al estado real
// de los efectos en vez de suponer que ya está cuando vuelve el control.
async function esperarEfectos(page: Page, esperados: { tipo: string; nave: number; turnosRestantes: number }[]): Promise<void> {
  try {
    await page.waitForFunction(
      (json) => JSON.stringify(window.__debug.efectos) === json && window.__debug.animacionEnCurso === false && window.__debug.control!.puedeDisparar === true,
      JSON.stringify(esperados),
      { timeout: 120000 },
    );
  } catch (error) {
    // Sin el estado real, un timeout no dice si faltó el efecto, la animación o el turno.
    const estado = await volcarEstado(page);
    throw new Error(`esperando ${JSON.stringify(esperados)}, estado ${estado}`, { cause: error });
  }
}

// evt-1, límite del caso vitaminas-doblan-danio: el efecto dura exactamente 3
// turnos de la nave 0 y después desaparece. La magnitud del daño (2·D) la fija el
// unit test evt-1 con avanzar() real: por UI depende del redondeo de la barra,
// de los cráteres y del desplazamiento del rival tras cada impacto, y no es una
// medida determinista. El calendario se fija en un evento lejano para que
// ningún sorteo (gravedad, terremoto...) altere los vuelos.
test("vitaminas: el efecto dura exactamente 3 turnos de la nave 0 y después desaparece", async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?eventos=1&mapa=calma-de-los-restos&modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.fijarProximoEvento !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.evaluate(() => window.__debug.fijarProximoEvento!({ enTurnos: 50, tipo: "virus", afectado: 1 }));

  await dispararYMedirDanio(page);
  // Tras mi disparo la IA aún responde con el estado anterior en la mano: si el
  // calendario se fija antes de que acabe, su cierre de turno lo pisa.
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true && window.__debug.animacionEnCurso === false, undefined, { timeout: 120000 });
  expect(await page.evaluate(() => window.__debug.efectos)).toEqual([]);
  await page.evaluate(() => window.__debug.fijarProximoEvento!({ enTurnos: 1, tipo: "vitaminas", afectado: 0 }));
  await dispararYMedirDanio(page);
  await esperarEfectos(page, [{ tipo: "vitaminas", nave: 0, turnosRestantes: 3 }]);
  await page.evaluate(() => window.__debug.fijarProximoEvento!({ enTurnos: 50, tipo: "virus", afectado: 1 }));

  // Cada turno propio gasta uno: 3 → 2 → 1 → desaparece.
  for (const restantes of [2, 1, 0]) {
    await dispararYMedirDanio(page);
    await esperarEfectos(page, restantes === 0 ? [] : [{ tipo: "vitaminas", nave: 0, turnosRestantes: restantes }]);
  }
});
