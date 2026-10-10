import { test, expect, type Page } from "@playwright/test";

async function empezar(page: Page, parametros: string): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?${parametros}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

async function abrirEquipo(page: Page): Promise<void> {
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
}

// esc-4: cada celda de Equipo lleva su línea de ayuda y, sin saldo, dice por qué
// está deshabilitada.
test("escudo: las celdas de Equipo se explican y sin saldo dicen cuánto falta", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, "modo=presupuesto&saldo=50");
  await abrirEquipo(page);
  await expect(page.getByTestId("ayuda-equipo-escudo")).toHaveText("Te protege de los disparos de los demás durante 2 turnos tuyos. Gasta el turno.");
  await expect(page.getByTestId("ayuda-equipo-propulsores")).toHaveText("Vuela con la gravedad hasta el círculo marcado. Gasta el turno.");
  await expect(page.getByTestId("equipo-escudo")).toBeDisabled();
  await expect(page.getByTestId("faltan-equipo-escudo")).toContainText("Te faltan 40 cr");
  // 50 cr alcanzan para los propulsores (60 no): también deshabilitados, por 10.
  await expect(page.getByTestId("faltan-equipo-propulsores")).toContainText("Te faltan 10 cr");
});

// esc-1 de punta a punta contra la IA: el escudo se paga, gasta el turno, su
// anillo muestra los turnos que quedan y el disparo de la IA no hace daño.
test("escudo: se paga, gasta el turno y la IA no le hace daño", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page, "modo=presupuesto");
  const saldoInicial = await page.evaluate(() => window.__debug.saldo!);
  const turno = await page.evaluate(() => window.__debug.numeroTurno!);

  await abrirEquipo(page);
  await page.getByTestId("equipo-escudo").click();
  await expect(page.getByTestId("disparar")).toHaveText("Activar escudo (90 cr)");
  await page.getByTestId("disparar").click();

  // Se ve el anillo con la insignia «2» en cuanto se activa, antes de que la IA juegue.
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turno, { timeout: 30000 });
  // Después de que la IA haya disparado (con o sin acierto), vuelve a ser jugable.
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true && window.__debug.animacionEnCurso === false, undefined, { timeout: 60000 });
  expect(await page.evaluate(() => window.__debug.saldo)).toBe(saldoInicial - 90);
  const naves = await page.evaluate(() => window.__debug.naves!);
  expect(naves[0].integridad).toBe(150);
  // El turno de la IA ya ha pasado: al empezar el nuestro baja de 2 a 1.
  expect(naves[0].escudo).toBe(1);

  // Con el escudo puesto, el botón de acción lo dice y no deja repetirlo.
  await abrirEquipo(page);
  await page.getByTestId("equipo-escudo").click();
  await expect(page.getByTestId("disparar")).toHaveText("Ya tienes el escudo activo");
  await expect(page.getByTestId("disparar")).toBeDisabled();
});
