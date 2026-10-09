import { test, expect } from "@playwright/test";
import { abrirSelector, dispararConSolucionExacta, empezarPresupuesto, esperarJugable } from "./utilesCompra";

// cat-3: de punta a punta por la UI real, a 360x640. Una celda con icono por
// arma, pulsable con comodidad, y el arma elegida es la que se dispara.
// El minirobot subió el catálogo de 14 a 15 armas: el conteo es parte de lo que se comprueba.
const ARMAS_EN_CATALOGO = 15;

test("selector-iconos: una celda con icono por arma, ≥ 44 px y 6 px de separación, sin scroll horizontal", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page, { saldo: 40 });
  await abrirSelector(page);

  const celdas = page.locator('[data-testid^="arma-"]');
  expect(await celdas.count()).toBe(ARMAS_EN_CATALOGO);

  const cajas: { x: number; y: number; width: number; height: number }[] = [];
  for (let i = 0; i < ARMAS_EN_CATALOGO; i++) {
    const celda = celdas.nth(i);
    await celda.scrollIntoViewIfNeeded();
    const caja = (await celda.boundingBox())!;
    cajas.push(caja);
    expect(caja.width).toBeGreaterThanOrEqual(44);
    expect(caja.height).toBeGreaterThanOrEqual(44);
    const id = (await celda.getAttribute("data-testid"))!.replace("arma-", "");
    await expect(celda.locator(`svg[data-testid="icono-${id}"]`)).toHaveCount(1);
  }
  // Separación mínima entre celdas contiguas de una misma fila.
  for (let i = 0; i < cajas.length - 1; i++) {
    const a = cajas[i];
    const b = cajas[i + 1];
    if (Math.abs(a.y - b.y) < 1) expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(6 - 0.5);
  }

  const sinScrollHorizontal = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(sinScrollHorizontal).toBe(true);

  // Las utilitarias enseñan su propio eje, no «Daño 0 · Acierto 0 %».
  for (const id of ["vertedero-portatil", "graviton-segunda-mano"]) {
    const texto = (await page.getByTestId(`arma-${id}`).textContent())!;
    expect(texto).not.toContain("Daño 0");
    expect(texto).not.toContain("Acierto 0");
  }
  await expect(page.getByTestId("eje-vertedero-portatil")).toContainText("Relleno:");
  await expect(page.getByTestId("eje-graviton-segunda-mano")).toContainText("Empuje:");

  // Con saldo 40: cada celda de pago muestra su precio y las de más de 40 quedan deshabilitadas.
  await expect(page.getByTestId("precio-mortero-lamentable")).toContainText("45 cr");
  await expect(page.getByTestId("arma-mortero-lamentable")).toBeDisabled();
  await expect(page.getByTestId("faltan-mortero-lamentable")).toContainText("Te faltan 5 cr");
  await expect(page.getByTestId("arma-pepinazo-cortesia")).toBeEnabled();
});

test("selector-iconos: elegir una arma y disparar dispara esa arma y su icono queda en la barra mínima", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page, { saldo: 200 });
  await abrirSelector(page);
  await page.getByTestId("arma-mortero-lamentable").click();
  await dispararConSolucionExacta(page, "mortero-lamentable");
  await esperarJugable(page);
  // ultimaEntrada ya sería la de la IA (esperarJugable espera a que vuelva el turno): el último disparo del humano vive en el control.
  expect(await page.evaluate(() => window.__debug.control!.ultimoDisparo?.armaId)).toBe("mortero-lamentable");
  // Plegada la consola, la barra mínima enseña el icono del arma elegida.
  await page.getByTestId("boton-plegar-consola").click();
  await expect(page.getByTestId("barra-minima").locator('svg[data-testid="icono-mortero-lamentable"]')).toHaveCount(1);
});
