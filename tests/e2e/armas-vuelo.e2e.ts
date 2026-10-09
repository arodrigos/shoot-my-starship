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
  // El icono se lee en la celda del selector, antes de elegir: al elegir, el selector se cierra.
  const trazadoIcono = await page
    .getByTestId("arma-pelota-de-chatarra")
    .getByTestId("icono-trazado-pelota-de-chatarra")
    .getAttribute("d", { timeout: 5000 });
  await page.getByTestId("arma-pelota-de-chatarra").click();
  await page.waitForFunction(() => window.__debug.armaEnReposo?.armaId === "pelota-de-chatarra", undefined, { timeout: 2000 });

  const definicion = await page.evaluate(() => window.__debug.armas!["pelota-de-chatarra"]);
  expect(trazadoIcono).toBe(definicion.trazado);
  expect(definicion.textura).toBe("arma-pelota-de-chatarra");

  const reposo = await page.evaluate(() => window.__debug.armaEnReposo!);
  const angulo = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
  expect(Math.abs((reposo.rotacion * 180) / Math.PI + angulo)).toBeLessThanOrEqual(1);
});

test("arm-1: el proyectil en vuelo conserva la textura del arma y gira sobre sí misma", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page, { saldo: 600 });
  await empezarAMuestrear(page);
  await dispararConSolucionExacta(page, "pelota-de-chatarra");
  const muestras = (await leerMuestras(page)).filter((m) => m.armaId === "pelota-de-chatarra");
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
  // Solo el vuelo del Pepinazo: el turno de la IA, que se muestrea después, lleva otra arma que gira.
  const muestras = (await leerMuestras(page)).filter((m) => m.armaId === "pepinazo-cortesia");
  expect(muestras.length).toBeGreaterThan(5);
  // El primer fotograma tras el disparo aún no ha orientado la imagen: se descarta.
  const alineadas = muestras.slice(1).filter((m) => Math.abs(diferencia(m.rotacion - m.rumbo)) <= (2 * Math.PI) / 180);
  expect(alineadas.length / (muestras.length - 1)).toBeGreaterThanOrEqual(0.95);
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
