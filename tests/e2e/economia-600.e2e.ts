import { test, expect } from "@playwright/test";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { costeArma } from "@/sim/partida/economia";
import { abrirSelector, dispararConSolucionExacta, empezarPresupuesto, esperarJugable } from "./utilesCompra";

// cal-6b: de punta a punta por la UI real, a 360x640. Los precios del
// selector son los del catálogo recalibrado y con 600 cr se puede comprar.
const PRECIO_MAXIMO = Math.max(...CATALOGO_ARMAS.map(costeArma));
const RACIMO = CATALOGO_ARMAS.find((arma) => arma.id === "racimo-de-tuppers")!;

test("economia-600: el selector enseña los precios nuevos y el Racimo se compra con 600 cr", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page);
  await expect(page.getByTestId("saldo")).toHaveText(`Saldo: ${PRESUPUESTO_BASE} cr`);
  await esperarJugable(page);
  await abrirSelector(page);

  for (const arma of CATALOGO_ARMAS) {
    await expect(page.getByTestId(`precio-${arma.id}`)).toHaveText(costeArma(arma) > 0 ? `${costeArma(arma)} cr` : "Gratis");
  }
  expect(PRECIO_MAXIMO).toBeLessThanOrEqual(150);
  // Con 600 cr ninguna arma queda deshabilitada por precio.
  await expect(page.locator('[data-testid^="faltan-"]')).toHaveCount(0);

  // Al elegir un arma el selector se cierra; el ayudante lo vuelve a abrir.
  await page.getByTestId(`arma-${RACIMO.id}`).click();
  const integridadAntes = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!.integridad;
  await dispararConSolucionExacta(page, RACIMO.id);
  await esperarJugable(page);
  await expect(page.getByTestId("saldo")).toHaveText(`Saldo: ${PRESUPUESTO_BASE - costeArma(RACIMO)} cr`);
  const integridadDespues = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!.integridad;
  expect(integridadDespues).toBeLessThan(integridadAntes);
});

test("economia-600: con menos saldo que un precio esa arma queda deshabilitada con «Te faltan N cr» y las gratis siguen disponibles", async ({ page }) => {
  test.setTimeout(120000);
  await empezarPresupuesto(page, { saldo: costeArma(RACIMO) - 5 });
  await abrirSelector(page);
  await expect(page.getByTestId(`arma-${RACIMO.id}`)).toBeDisabled();
  await expect(page.getByTestId(`faltan-${RACIMO.id}`)).toContainText("Te faltan 5 cr");
  for (const gratis of CATALOGO_ARMAS.filter((arma) => costeArma(arma) === 0)) {
    await expect(page.getByTestId(`arma-${gratis.id}`)).toBeEnabled();
  }
});
