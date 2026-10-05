import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// economia-loadout: de punta a punta por la pantalla real, a 360x640, sobre
// un mapa de suelo plano sembrado (deriva 0) donde existe la solución
// balística exacta y el apuntado es determinista.
const MAPA_SEMBRADO = "calma-de-los-restos";

async function empezarPresupuesto(page: Page, saldo?: number): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}&modo=presupuesto${saldo === undefined ? "" : `&saldo=${saldo}`}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
}

async function cerrarAyuda(page: Page): Promise<void> {
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

async function esperarJugable(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
}

async function idsEnSelector(page: Page): Promise<string[]> {
  await page.getByTestId("selector-arma-abrir").click();
  const ids = await page
    .locator('[data-testid^="arma-"]')
    .evaluateAll((nodos) => nodos.map((nodo) => (nodo.getAttribute("data-testid") ?? "").replace("arma-", "")));
  return ids;
}

// Dispara el turno actual con el arma ya elegida y espera a que acabe.
async function dispararConSolucionExacta(page: Page, armaId: string): Promise<void> {
  await esperarJugable(page);
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId(`arma-${armaId}`).click();
  const numeroTurno = await page.evaluate(() => window.__debug.numeroTurno!);
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion, "debe existir solución exacta en un mapa de deriva 0").not.toBeNull();
  await arrastrarBarraHasta(page, "barra-angulo", (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS));
  await arrastrarBarraHasta(page, "barra-potencia", (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA));
  await page.getByTestId("disparar").click();
  await page.waitForFunction((anterior) => (window.__debug.numeroTurno ?? 0) > anterior, numeroTurno, { timeout: 30000 });
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 30000 });
}

test("economia-loadout-3/6: lo elegido es lo que se puede disparar, disparar lo consume y el daño se aplica; la pantalla cumple axe a 360x640", async ({
  page,
}) => {
  test.setTimeout(180000);
  await empezarPresupuesto(page);

  // economia-loadout-6: las 16 armas con coste, daño y facilidad visibles.
  await expect(page.getByTestId("pantalla-seleccion")).toBeVisible();
  await expect(page.locator('[data-testid^="seleccion-arma-"]')).toHaveCount(16);
  await expect(page.getByTestId("seleccion-datos-despedida")).toHaveText(/Daño 55 · Acierto \d+(\.\d+)?%/);
  await expect(page.getByTestId("seleccion-coste-despedida")).toHaveText("120 cr");
  await expect(page.getByTestId("seleccion-coste-zanjadora-manolita")).toHaveText("Gratis");
  const axe = await new AxeBuilder({ page }).withRules(["target-size", "color-contrast"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: "test-results/economia-loadout/economia-loadout-seleccion-360x640.png" });

  // economia-loadout-1: el saldo baja al elegir.
  await page.getByTestId("seleccion-arma-tostadora-orbital").click();
  await page.getByTestId("seleccion-arma-despedida").click();
  await expect(page.getByTestId("seleccion-saldo")).toHaveText("805 cr");
  await page.getByTestId("seleccion-confirmar").click();
  await expect(page.getByTestId("pantalla-seleccion")).toHaveCount(0);
  await cerrarAyuda(page);
  await esperarJugable(page);

  // economia-loadout-3: el selector ofrece exactamente esas 2.
  expect((await idsEnSelector(page)).sort()).toEqual(["despedida", "tostadora-orbital"]);
  await page.getByTestId("selector-arma-abrir").click();

  const integridadAntes = await page.evaluate(() => window.__debug.naves![1].integridad);
  await dispararConSolucionExacta(page, "tostadora-orbital");
  const integridadDespues = await page.evaluate(() => window.__debug.naves![1].integridad);
  expect(integridadDespues, "el disparo tiene que haber dañado al rival").toBeLessThan(integridadAntes);

  // La disparada deja de estar disponible; la no disparada sigue ahí; y el
  // saldo no se mueve por haber hecho daño (no hay ingreso por daño).
  await page.waitForFunction(() => window.__debug.turno === 0 && window.__debug.animacionEnCurso === false, undefined, { timeout: 60000 });
  await esperarJugable(page);
  expect(await idsEnSelector(page)).toEqual(["despedida"]);
  expect(await page.evaluate(() => window.__debug.saldo)).toBe(805);
});

test("economia-loadout-2/7: arma impagable explica cuánto falta y salir sin armas avisa de las 3 gratis, con las que se sigue jugando", async ({
  page,
}) => {
  test.setTimeout(180000);
  await empezarPresupuesto(page, 100);

  // 100 cr no pagan Despedida (120): faltan 20.
  await page.getByTestId("pantalla-seleccion").waitFor();
  await page.getByTestId("seleccion-arma-despedida").click();
  await expect(page.getByTestId("seleccion-error")).toContainText("20 créditos más");
  await expect(page.getByTestId("seleccion-saldo")).toHaveText("100 cr");

  // Confirmar sin elegir: aviso primero, y solo la segunda pulsación empieza.
  await page.getByTestId("seleccion-confirmar").click();
  await expect(page.getByTestId("seleccion-aviso-vacio")).toContainText("3 gratis");
  await expect(page.getByTestId("pantalla-seleccion")).toBeVisible();
  await page.getByTestId("seleccion-confirmar").click();
  await expect(page.getByTestId("pantalla-seleccion")).toHaveCount(0);
  await cerrarAyuda(page);
  await esperarJugable(page);

  // Exactamente las 3 gratis, y el turno se puede jugar con ellas.
  expect((await idsEnSelector(page)).sort()).toEqual(["pelota-de-chatarra", "petardo-de-feria", "zanjadora-manolita"]);
  await page.getByTestId("selector-arma-abrir").click();
  await dispararConSolucionExacta(page, "zanjadora-manolita");
  await page.waitForFunction(() => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2, undefined, { timeout: 60000 });
  await esperarJugable(page);
  // Las gratis no se consumen.
  expect((await idsEnSelector(page)).sort()).toEqual(["pelota-de-chatarra", "petardo-de-feria", "zanjadora-manolita"]);
});

test("economia-loadout-5: en hot-seat cada humano elige en su relevo y el arsenal ajeno no está en el DOM en ningún momento", async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("humanos-2").click();
  await page.getByTestId("ias-0").click();
  await page.getByTestId("nombre-jugador-0").pressSequentially("Ana");
  await page.getByTestId("nombre-jugador-1").pressSequentially("Luis");
  await page.getByTestId("modo-presupuesto").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");

  // Ana: primero identificarse, y hasta entonces ni saldo ni lista en el DOM.
  await expect(page.getByTestId("pantalla-seleccion")).toBeVisible();
  await expect(page.getByTestId("seleccion-saldo")).toHaveCount(0);
  await expect(page.getByTestId("saldo")).toHaveCount(0);
  await page.getByTestId("seleccion-identificar").click();
  await page.getByTestId("seleccion-arma-tostadora-orbital").click();
  await page.getByTestId("seleccion-arma-pepinazo-cortesia").click();
  await page.getByTestId("seleccion-confirmar").click();

  // Luis: la selección de Ana ya no está en el DOM ni en pantalla.
  await expect(page.getByTestId("seleccion-identificar")).toBeVisible();
  await expect(page.getByTestId("seleccion-lista")).toHaveCount(0);
  await expect(page.getByTestId("seleccion-saldo")).toHaveCount(0);
  await page.getByTestId("seleccion-identificar").click();
  await expect(page.getByTestId("seleccion-saldo")).toHaveText("1000 cr");
  await expect(page.locator('[data-testid^="seleccion-arma-"][aria-pressed="true"]')).toHaveCount(0);
  await page.getByTestId("seleccion-arma-despedida").click();
  await page.getByTestId("seleccion-confirmar").click();

  // Empieza Ana: relevo hacia ella, y solo ve lo suyo.
  await expect(page.getByTestId("relevo-jugador")).toHaveText("Turno de Ana");
  await expect(page.locator('[data-testid^="arma-"]')).toHaveCount(0);
  await page.getByTestId("relevo-confirmar").click();
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined);
  await cerrarAyuda(page);
  await esperarJugable(page);
  expect((await idsEnSelector(page)).sort()).toEqual(["pepinazo-cortesia", "tostadora-orbital"]);
  await page.getByTestId("selector-arma-abrir").click();
  await dispararConSolucionExacta(page, "tostadora-orbital");

  // Turno de Luis, durante el relevo y tras él: nada de Ana (ni la que le queda).
  await expect(page.getByTestId("pantalla-relevo")).toBeVisible();
  await expect(page.getByTestId("saldo")).toHaveCount(0);
  await expect(page.locator('[data-testid^="arma-"]')).toHaveCount(0);
  await page.getByTestId("relevo-confirmar").click();
  await esperarJugable(page);
  expect(await idsEnSelector(page)).toEqual(["despedida"]);
  await expect(page.getByTestId("arma-pepinazo-cortesia")).toHaveCount(0);
  await expect(page.getByTestId("arma-tostadora-orbital")).toHaveCount(0);
});
