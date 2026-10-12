import { test, expect } from "@playwright/test";
import { abrirSelector, empezarPresupuesto } from "./utilesCompra";

const ELIMINADAS = ["mortero-lamentable", "petardo-de-feria", "granada-de-espoleta"];

// arm-r1: el selector enseña las 12 armas que quedan, a los tamaños de móvil
// y de iPad en horizontal. Las capturas (CAPTURAS_DIR) son para el juicio
// visual del gatekeeper.
for (const tamano of [
  { ancho: 360, alto: 640 },
  { ancho: 1180, alto: 820 },
]) {
  test(`arm-r1: el selector enseña 12 armas a ${tamano.ancho}x${tamano.alto}`, async ({ page }) => {
    test.setTimeout(180000);
    await empezarPresupuesto(page);
    await page.setViewportSize({ width: tamano.ancho, height: tamano.alto });
    await abrirSelector(page);

    const celdas = page.locator('[data-testid^="arma-"]');
    expect(await celdas.count()).toBe(12);
    for (const id of ELIMINADAS) await expect(page.getByTestId(`arma-${id}`)).toHaveCount(0);
    await expect(page.getByTestId("arma-racimo-de-tuppers")).toHaveCount(1);

    for (const id of ["arma-zanjadora-manolita", "arma-pelota-de-chatarra"]) {
      await expect(page.getByTestId(id)).toContainText("Gratis");
    }
    const precios = await page.locator('[data-testid^="precio-"]').allTextContents();
    for (const texto of precios) {
      const cr = Number(texto.replace(/[^\d]/g, ""));
      if (cr > 0) expect(cr % 5).toBe(0);
    }
    if (process.env.CAPTURAS_DIR) {
      await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/armas-recorte-selector-${tamano.ancho}x${tamano.alto}.png` });
    }
  });
}

// arm-r3: un arma guardada que ya no existe no rompe el arranque.
for (const eliminada of ["granada-de-espoleta", "mortero-lamentable"]) {
  test(`arm-r3: con "${eliminada}" guardada la partida arranca con el arma por defecto`, async ({ page }) => {
    test.setTimeout(180000);
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(m.text());
    });
    await page.addInitScript((id) => {
      window.localStorage.setItem("control-apuntado:ajuste", JSON.stringify({ anguloGrados: 45, potencia: 50, armaId: id }));
    }, eliminada);
    await empezarPresupuesto(page);
    expect(await page.evaluate(() => window.__debug.control!.ajuste.armaId)).toBe("pepinazo-cortesia");
    expect(errores).toEqual([]);
  });
}
