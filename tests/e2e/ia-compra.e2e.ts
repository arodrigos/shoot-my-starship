import { test, expect } from "@playwright/test";
import { dispararConSolucionExacta, empezarPresupuesto } from "./utilesCompra";

// eco-1: con saldos [850, 850] el Almirante Bisagra compra en su turno el arma
// de pago más cara de su orden de preferencia que puede pagar (Despedida, 125)
// y se le descuenta el precio exacto; el humano, que disparó una gratis,
// conserva su saldo.
test("ia-compra: la IA agresiva compra en su turno y se le descuenta el precio exacto", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page, { saldo: 850, rival: "almirante-bisagra" });
  expect(await page.evaluate(() => window.__debug.saldos)).toEqual([850, 850]);

  await dispararConSolucionExacta(page, "petardo-de-feria");
  await page.waitForFunction(() => window.__debug.ultimaEntrada?.nave === 1 && (window.__debug.numeroTurno ?? 0) >= 2, undefined, { timeout: 90000 });

  const { entrada, saldos } = await page.evaluate(() => ({ entrada: window.__debug.ultimaEntrada, saldos: window.__debug.saldos }));
  expect(entrada?.arma).toBe("despedida");
  expect(saldos).toEqual([850, 850 - 125]);
});

// Límite de eco-1: con menos saldo que cualquier arma de ataque de pago la IA
// dispara una gratis sin error y su saldo no cambia.
test("ia-compra: con 30 cr la IA dispara una gratis y conserva su saldo", async ({ page }) => {
  test.setTimeout(240000);
  await empezarPresupuesto(page, { saldo: 30, rival: "almirante-bisagra" });
  await dispararConSolucionExacta(page, "petardo-de-feria");
  await page.waitForFunction(() => window.__debug.ultimaEntrada?.nave === 1 && (window.__debug.numeroTurno ?? 0) >= 2, undefined, { timeout: 90000 });
  const { entrada, saldos } = await page.evaluate(() => ({ entrada: window.__debug.ultimaEntrada, saldos: window.__debug.saldos }));
  expect(["zanjadora-manolita", "petardo-de-feria", "pelota-de-chatarra"]).toContain(entrada?.arma);
  expect(saldos).toEqual([30, 30]);
});
