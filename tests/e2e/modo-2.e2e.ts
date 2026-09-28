import { test, expect } from "@playwright/test";

const ARMA_GRATIS_ID = "pepinazo-cortesia";
const ARMA_DE_PAGO_ID = "tostadora-orbital";

// modo-2: con el saldo forzado a 0, las tres gratis siguen disparables de
// punta a punta y las de pago aparecen deshabilitadas pero visibles con su
// precio -- el criterio que impide un modo presupuesto con callejón sin
// salida.
test("modo-2: con saldo 0, las armas gratis siguen disparables y las de pago quedan deshabilitadas con su precio visible", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos&modo=presupuesto&saldo=0");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.saldo === 0);

  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await page.getByTestId("selector-arma-abrir").click();

  const botonPago = page.getByTestId(`arma-${ARMA_DE_PAGO_ID}`);
  await expect(botonPago).toBeVisible();
  await expect(botonPago).toBeDisabled();
  await expect(page.getByTestId(`precio-${ARMA_DE_PAGO_ID}`)).toBeVisible();

  const botonGratis = page.getByTestId(`arma-${ARMA_GRATIS_ID}`);
  await expect(botonGratis).toBeEnabled();
  await botonGratis.click();

  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno))!;
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  await page.waitForFunction(
    (turnoAntes) => (window.__debug.numeroTurno ?? 0) > turnoAntes && window.__debug.animacionEnCurso === false,
    numeroTurnoAntes,
    { timeout: 60000 },
  );

  // Disparar gratis no ha costado nada: el saldo se mantiene en 0 (nunca
  // negativo).
  expect(await page.evaluate(() => window.__debug.saldo)).toBe(0);
});
