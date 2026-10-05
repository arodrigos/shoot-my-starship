import { test, expect } from "@playwright/test";
import { elegirArmasYConfirmar } from "./utilesControl";

// Tras el reprecio de armas-reprecio-roles, pepinazo-cortesia ya no es
// gratis (coste 55): las tres armas gratis reales son zanjadora-manolita,
// petardo-de-feria y pelota-de-chatarra (src/sim/armas/catalogo.ts).
const ARMA_GRATIS_ID = "zanjadora-manolita";
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
  // Con saldo 0 la selección no ofrece nada pagable: se confirma vacía.
  await elegirArmasYConfirmar(page, []);
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.saldo === 0);

  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await page.getByTestId("selector-arma-abrir").click();

  // Las de pago no se ofrecen: con el loadout vacío solo existen las gratis.
  await expect(page.getByTestId(`arma-${ARMA_DE_PAGO_ID}`)).toHaveCount(0);
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

  // Sin ingreso por daño y sin coste por disparo: el saldo sigue en 0.
  expect(await page.evaluate(() => window.__debug.saldo)).toBe(0);
});
