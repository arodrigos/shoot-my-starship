import { test, expect, type Page } from "@playwright/test";

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
    const registro: { texto: string; alto: number; desde: number; hasta: number | null } = { texto: "", alto: 0, desde: 0, hasta: null };
    (window as unknown as { __cartelRegistro: typeof registro }).__cartelRegistro = registro;
    new MutationObserver(() => {
      const nodo = document.querySelector('[data-testid="cartel-evento"]');
      if (nodo !== null && registro.desde === 0) {
        registro.desde = performance.now();
        registro.texto = nodo.textContent ?? "";
        registro.alto = nodo.getBoundingClientRect().height;
      } else if (nodo === null && registro.desde !== 0 && registro.hasta === null) {
        registro.hasta = performance.now();
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => (window as unknown as { __cartelRegistro: { hasta: number | null } }).__cartelRegistro.hasta !== null, undefined, { timeout: 90000 });
  const registro = await page.evaluate(() => (window as unknown as { __cartelRegistro: { texto: string; alto: number; desde: number; hasta: number } }).__cartelRegistro);
  expect(registro.texto).toContain("Vitaminas artificiales");
  expect(registro.alto).toBeLessThanOrEqual(56);
  expect(registro.hasta - registro.desde).toBeGreaterThanOrEqual(2000);
  expect(registro.hasta - registro.desde).toBeLessThanOrEqual(3500);

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
