import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// ctl-2 (control-angulo-potencia): la queja concreta de Adrián -- girar de
// 2° a 178° (el giro de 180°) en UN solo gesto sobre el control de ángulo,
// sin tocar la potencia. Con el arrastre único de antes esto exigía dos
// gestos verticales opuestos porque saturaba antes de cubrir el rango
// entero; con el mapeo absoluto de barra-angulo, un extremo a otro basta.
test("un solo gesto de un extremo a otro del control de ángulo va de 2° a 178° sin tocar la potencia", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // Se deja primero en el extremo mínimo para que el gesto de prueba
  // recorra el rango entero de un extremo físico al otro.
  await arrastrarBarraHasta(page, "barra-angulo", 0);
  const potenciaAntes = (await page.evaluate(() => window.__debug.control!.ajuste.potencia))!;
  expect(await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados)).toEqual(ANGULO_MINIMO_GRADOS);

  await arrastrarBarraHasta(page, "barra-angulo", 1);

  const anguloFinal = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
  const potenciaDespues = await page.evaluate(() => window.__debug.control!.ajuste.potencia);
  expect(anguloFinal).toEqual(ANGULO_MAXIMO_GRADOS);
  expect(potenciaDespues).toEqual(potenciaAntes);
});
