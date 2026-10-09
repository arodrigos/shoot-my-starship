import { test, expect, type Page } from "@playwright/test";
import { abrirSelector, dispararConSolucionExacta, empezarPresupuesto, esperarJugable } from "./utilesCompra";

interface Muestra {
  armaId: string;
  textura: string;
  rotacion: number;
  rumbo: number;
  particulasEstela: number;
}
type VentanaMuestras = { __muestras: Muestra[] };

async function empezarAMuestrear(page: Page): Promise<void> {
  await page.evaluate(() => {
    const ventana = window as unknown as VentanaMuestras;
    ventana.__muestras = [];
    const tomar = () => {
      const visual = window.__debug.proyectilVisual;
      if (visual) ventana.__muestras.push({ ...visual });
      requestAnimationFrame(tomar);
    };
    tomar();
  });
}

const leerMuestras = (page: Page) => page.evaluate(() => (window as unknown as VentanaMuestras).__muestras);

// Diferencia angular normalizada a (-π, π].
const diferencia = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test("arm-1: el icono del selector, el arma en reposo y el proyectil en vuelo comparten forma y textura", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page, { saldo: 600 });
  await esperarJugable(page);
  await abrirSelector(page);
  await page.getByTestId("arma-pelota-de-chatarra").click();
  await page.waitForFunction(() => window.__debug.armaEnReposo?.armaId === "pelota-de-chatarra", undefined, { timeout: 2000 });

  const trazadoIcono = await page.getByTestId("icono-trazado-pelota-de-chatarra").first().getAttribute("d");
  const definicion = await page.evaluate(() => window.__debug.armas!["pelota-de-chatarra"]);
  expect(trazadoIcono).toBe(definicion.trazado);
  expect(definicion.textura).toBe("arma-pelota-de-chatarra");

  const reposo = await page.evaluate(() => window.__debug.armaEnReposo!);
  const angulo = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
  expect(Math.abs((reposo.rotacion * 180) / Math.PI + angulo)).toBeLessThanOrEqual(1);

  // dispararConSolucionExacta abre el selector por su cuenta: si sigue abierto
  // tras elegir, ese segundo clic lo cerraría y la celda no se podría pulsar.
  if (await page.getByTestId("arma-pelota-de-chatarra").isVisible()) await abrirSelector(page);
  await empezarAMuestrear(page);
  await dispararConSolucionExacta(page, "pelota-de-chatarra");
  const muestras = await leerMuestras(page);
  expect(muestras.length).toBeGreaterThan(3);
  for (const m of muestras) expect(m.textura).toBe("arma-pelota-de-chatarra");

  // arm-2 (límite): la Pelota gira sobre sí misma además del rumbo.
  const giros = new Set(muestras.map((m) => Math.round(diferencia(m.rotacion - m.rumbo) * 10)));
  expect(giros.size).toBeGreaterThanOrEqual(3);
});

test("arm-2: el proyectil apunta a su rumbo y deja estela desde los primeros fotogramas", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page, { saldo: 600 });
  await empezarAMuestrear(page);
  await dispararConSolucionExacta(page, "pepinazo-cortesia");
  const muestras = await leerMuestras(page);
  expect(muestras.length).toBeGreaterThan(5);
  const alineadas = muestras.filter((m) => Math.abs(diferencia(m.rotacion - m.rumbo)) <= (2 * Math.PI) / 180);
  expect(alineadas.length / muestras.length).toBeGreaterThanOrEqual(0.95);
  expect(muestras.slice(3).some((m) => m.particulasEstela > 0)).toBe(true);
  // Invariante del presupuesto: ninguna muestra pasa del techo del móvil.
  for (const m of muestras) expect(m.particulasEstela).toBeLessThanOrEqual(120);
});

test("arm-2: con movimiento reducido no hay estela ni giro y el proyectil sigue visible", async ({ page }) => {
  test.setTimeout(240000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await empezarPresupuesto(page, { saldo: 600 });
  await empezarAMuestrear(page);
  await dispararConSolucionExacta(page, "pelota-de-chatarra");
  const muestras = await leerMuestras(page);
  expect(muestras.length).toBeGreaterThan(3);
  for (const m of muestras) {
    expect(m.particulasEstela).toBe(0);
    expect(Math.abs(diferencia(m.rotacion - m.rumbo))).toBeLessThan(1e-6);
  }
});
