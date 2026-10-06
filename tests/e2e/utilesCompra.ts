import { expect, type Page } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// Mapa de suelo plano sembrado (deriva 0): allí existe la solución balística
// exacta y el apuntado es determinista.
export const MAPA_SEMBRADO = "calma-de-los-restos";

export async function empezarPresupuesto(page: Page, opciones: { saldo?: number; rival?: string } = {}): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  const saldo = opciones.saldo === undefined ? "" : `&saldo=${opciones.saldo}`;
  await page.goto(`/?mapa=${MAPA_SEMBRADO}&modo=presupuesto${saldo}`);
  if (opciones.rival !== undefined) await page.getByTestId(`rival-${opciones.rival}`).click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

export async function esperarJugable(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

export async function abrirSelector(page: Page): Promise<void> {
  await page.getByTestId("selector-arma-abrir").click();
}

// Dispara el turno actual con el arma indicada y espera a que el turno pase.
export async function dispararConSolucionExacta(page: Page, armaId: string): Promise<void> {
  await esperarJugable(page);
  await abrirSelector(page);
  await page.getByTestId(`arma-${armaId}`).click();
  const numeroTurno = await page.evaluate(() => window.__debug.numeroTurno!);
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion, "debe existir solución exacta en un mapa de deriva 0").not.toBeNull();
  await arrastrarBarraHasta(page, "barra-angulo", (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS));
  await arrastrarBarraHasta(page, "barra-potencia", (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA));
  await page.getByTestId("disparar").click();
  await page.waitForFunction((anterior) => (window.__debug.numeroTurno ?? 0) > anterior, numeroTurno, { timeout: 60000 });
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 60000 });
}
