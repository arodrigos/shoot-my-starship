import { test, expect, type Locator, type Page } from "@playwright/test";

// El cartel de evento y el resumen vivían dentro de la capa de la consola, que
// se aparta (opacidad 0) en el turno del rival y desaparece con la consola
// oculta. toBeVisible() no lo ve (ignora la opacidad), así que aquí se mide la
// opacidad efectiva de toda la cadena de ancestros y se exige que sea 1.
export async function opacidadEfectiva(localizador: Locator): Promise<number> {
  return localizador.evaluate((nodo) => {
    let opacidad = 1;
    for (let actual: Element | null = nodo; actual !== null; actual = actual.parentElement) {
      const estilo = getComputedStyle(actual);
      if (estilo.display === "none" || estilo.visibility === "hidden") return 0;
      opacidad *= Number(estilo.opacity);
    }
    return opacidad;
  });
}

const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
] as const;

async function capturar(page: Page, nombre: string, ancho: number, alto: number): Promise<void> {
  const carpeta = process.env.CAPTURAS_DIR;
  if (carpeta) await page.screenshot({ path: `${carpeta}/${nombre}-${ancho}x${alto}.png` });
}

// 1 humano contra 2 IA, por la pantalla de inicio real: es la precondición del
// caso resumen-al-tercer-disparo y el que reventaba el gancho de turnos.
async function empezarContraDosIA(page: Page, ancho: number, alto: number): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto("/?mapa=calma-de-los-restos&eventos=1&modo=barra-libre");
  await page.getByTestId("ias-2").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.fijarMuerteSubita !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

for (const { ancho, alto } of TAMANOS) {
  // res-v1: el resumen del tercer turno se ve de verdad aunque caiga en el
  // turno del rival (consola apartada) y también con la consola oculta.
  test(`res-v1: a ${ancho}x${alto} el resumen del tercer turno se ve con 1 humano contra 2 IA, con la consola apartada y oculta`, async ({ page }) => {
    test.setTimeout(240000);
    await empezarContraDosIA(page, ancho, alto);
    await page.evaluate(() => window.__debug.jugarTurnosGuionizados!(2));
    await page.waitForFunction(() => (window.__debug.historialBromas?.length ?? 0) >= 2);
    // El tercer turno lo juega la IA de verdad, con el control del humano apartado.
    await page.waitForFunction(() => (window.__debug.historialBromas?.length ?? 0) >= 3, undefined, { timeout: 120000 });
    const resumen = page.getByTestId("resumen-texto");
    await expect(resumen).toBeVisible();
    expect(await opacidadEfectiva(resumen)).toBe(1);
    await capturar(page, "avisos-visibles-resumen", ancho, alto);

    // Con la consola oculta el resumen sigue en pantalla.
    await page.getByTestId("boton-ocultar-consola").click({ force: true });
    await expect(page.getByTestId("pestana-consola")).toBeVisible();
    expect(await opacidadEfectiva(resumen)).toBe(1);
    await capturar(page, "avisos-visibles-resumen-consola-oculta", ancho, alto);
  });
}

// anu-1/anu-2: el drenaje de la muerte súbita llega al cerrar la ronda, con el
// turno del rival o el vuelo en curso, y el cartel tiene que verse.
test("anu-1: el cartel de un evento que llega en el turno del rival se ve de verdad, también con la consola oculta", async ({ page }) => {
  test.setTimeout(240000);
  await empezarContraDosIA(page, 360, 640);
  await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 13, integridades: [150, 150, 150] }));
  await page.getByTestId("disparar").click();
  const cartel = page.getByTestId("cartel-evento");
  await expect(cartel).toBeVisible({ timeout: 120000 });
  expect(await opacidadEfectiva(cartel), "el cartel no cuelga de la capa de la consola apartada").toBe(1);
  await capturar(page, "avisos-visibles-cartel", 360, 640);
});
