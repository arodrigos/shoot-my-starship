import { test, expect } from "@playwright/test";
import { abrirSelector, dispararConSolucionExacta, empezarPresupuesto, esperarJugable, MAPA_SEMBRADO } from "./utilesCompra";

// eco-2 / eco-3: de punta a punta por la UI real, a 360x640. Precios de dev:
// Pepinazo 35, Mortero 45, Despedida 85.
test("compra-al-usar: todo está en el selector, el arma de pago se cobra al disparar y las gratis no cobran", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page, { saldo: 60 });

  await expect(page.getByTestId("tu-arsenal")).toHaveCount(0);
  await expect(page.getByTestId("pantalla-seleccion")).toHaveCount(0);
  await expect(page.getByTestId("saldo")).toHaveText("Saldo: 60 cr");

  await abrirSelector(page);
  await expect(page.locator('[data-testid^="arma-"]')).toHaveCount(15);
  await expect(page.getByTestId("arma-despedida")).toBeDisabled();
  await expect(page.getByTestId("faltan-despedida")).toContainText("Te faltan 25 cr");
  // eco-3: el selector avisa del daño reducido de cada gratis.
  await expect(page.getByTestId("gratis-reducida-petardo-de-feria")).toContainText("Gratis · daño reducido al 25 %");

  // Seleccionar y cambiar de arma no cobra.
  await page.getByTestId("arma-mortero-lamentable").click();
  await abrirSelector(page);
  await page.getByTestId("arma-pepinazo-cortesia").click();
  await expect(page.getByTestId("saldo")).toHaveText("Saldo: 60 cr");

  await dispararConSolucionExacta(page, "pepinazo-cortesia");
  await esperarJugable(page);
  await expect(page.getByTestId("saldo")).toHaveText("Saldo: 25 cr");

  await abrirSelector(page);
  await expect(page.getByTestId("arma-pepinazo-cortesia")).toBeDisabled();
  await expect(page.getByTestId("faltan-pepinazo-cortesia")).toContainText("Te faltan 10 cr");
  for (const gratis of ["petardo-de-feria", "zanjadora-manolita", "pelota-de-chatarra"]) {
    await expect(page.getByTestId(`arma-${gratis}`)).toBeEnabled();
  }
  await page.getByTestId("arma-petardo-de-feria").click();
  await dispararConSolucionExacta(page, "petardo-de-feria");
  await esperarJugable(page);
  await expect(page.getByTestId("saldo")).toHaveText("Saldo: 25 cr");
});

// eco-5
test("compra-al-usar: con 10 cr el selector dice qué pasa y las gratis siguen habilitadas", async ({ page }) => {
  test.setTimeout(120000);
  await empezarPresupuesto(page, { saldo: 10 });
  await abrirSelector(page);
  await expect(page.getByTestId("selector-sin-saldo")).toHaveText(
    "Sin saldo para armas de pago: te quedan las gratis (daño reducido). Un evento de lotería puede darte más.",
  );
  for (const gratis of ["petardo-de-feria", "zanjadora-manolita", "pelota-de-chatarra"]) {
    await expect(page.getByTestId(`arma-${gratis}`)).toBeEnabled();
  }
});

test("compra-al-usar: en barra libre no hay saldo y ninguna celda está deshabilitada por precio", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}&modo=barra-libre`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await expect(page.getByTestId("saldo")).toHaveCount(0);
  await abrirSelector(page);
  await expect(page.getByTestId("arma-despedida")).toBeEnabled();
  await expect(page.locator('[data-testid^="faltan-"]')).toHaveCount(0);
});

// sdo-1 de punta a punta: «Otra partida» arranca siempre con la base fija,
// sin sumar lo que sobró.
test("compra-al-usar: «Otra partida» arranca con 600 cr, sin arrastre", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page);
  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible({ timeout: 60000 });
  await page.getByTestId("otra-partida").click();
  await page.waitForFunction(() => window.__debug.saldo !== undefined && window.__debug.saldo !== null, undefined, { timeout: 30000 });
  expect(await page.evaluate(() => window.__debug.saldo)).toBe(600);
});
