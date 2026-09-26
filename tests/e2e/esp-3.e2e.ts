import { test, expect } from "@playwright/test";

// esp-3: el fondo de estrellas/nebulosa se hornea una sola vez en create()
// (fondoEspacial.bakes) y ningún redibujado por rectángulo sucio -- ni 60s
// de reloj real, ni disparos que agujerean planetas -- vuelve a tocarlo.
test("el contador de horneado del fondo vale 1 al empezar y sigue en 1 tras 60s y 10 disparos", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.fondoEspacial !== undefined);

  expect((await page.evaluate(() => window.__debug.fondoEspacial!.bakes))).toBe(1);

  // jugarTurnosGuionizados resuelve turnos reales (misma avanzar() que un
  // jugador) sin depender de la animación ni de gestos -- 10 disparos de
  // sobra sin pagar el coste de 10 vuelos animados completos (render-2).
  await page.evaluate(() => window.__debug.jugarTurnosGuionizados!(10));

  await page.waitForTimeout(60000);

  expect((await page.evaluate(() => window.__debug.fondoEspacial!.bakes))).toBe(1);
});
