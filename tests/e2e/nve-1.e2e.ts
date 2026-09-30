import { test, expect } from "@playwright/test";

// nve-1: aterrizar EXACTAMENTE en los tres tramos de integridad a fuerza de
// impactos reales no es determinista de apuntar a mano (mismo motivo que
// dispararEventoRoce en contacto-honesto), así que se fuerza con
// window.__debug.forzarIntegridad -- que pasa por el mismo
// refrescarNaves()/refrescarDebugNaves() que un turno real -- y se comprueba
// que las tres siluetas resultantes dan tres hashes distintos por nave. Las
// capturas quedan para el juicio visual del gatekeeper (rúbrica, eje 6).
test("nve-1: a integridad alta, media y baja la silueta de cada nave cambia de hash", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const tramos: { integridad: number; nivelEsperado: "alta" | "media" | "baja" }[] = [
    { integridad: 100, nivelEsperado: "alta" },
    { integridad: 50, nivelEsperado: "media" },
    { integridad: 10, nivelEsperado: "baja" },
  ];

  for (const nave of [0, 1] as const) {
    const hashesPorTramo = new Map<string, number>();

    for (const { integridad, nivelEsperado } of tramos) {
      await page.evaluate(
        ({ nave, integridad }) => window.__debug.forzarIntegridad!(nave, integridad),
        { nave, integridad },
      );

      const estado = (await page.evaluate(() => window.__debug.naves))!.find((n) => n.id === nave)!;
      expect(estado.nivelDanio).toBe(nivelEsperado);
      hashesPorTramo.set(nivelEsperado, estado.hashSilueta);

      if (nave === 1) {
        await page.screenshot({ path: `capturas/naves-siluetas-1-${nivelEsperado}-360x640.png` });
      }
    }

    const hashesUnicos = new Set(hashesPorTramo.values());
    expect(hashesUnicos.size, `nave ${nave}: hashes ${JSON.stringify([...hashesPorTramo])}`).toBe(3);
  }

  // El bando se distingue por color Y forma, no solo por color: las dos
  // naves parten de silueta "alta" con hashes distintos entre sí porque
  // puntosCascoConDanio ya recibe una dirección (1/-1) distinta por bando.
  await page.evaluate(() => window.__debug.forzarIntegridad!(0, 100));
  await page.evaluate(() => window.__debug.forzarIntegridad!(1, 100));
  const [nave0, nave1] = (await page.evaluate(() => window.__debug.naves))!;
  expect(nave0.hashSilueta).not.toBe(nave1.hashSilueta);
});
