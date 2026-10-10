import { test, expect, type Page } from "@playwright/test";

// pegajosa-borde (peg-1): el Gancho Pegajoso que sale del mundo se pierde como
// cualquier otra arma. Antes se quedaba dibujado en el borde y empezaba su
// cuenta atrás de 5 s. Las aserciones leen el estado real de la cáscara, no
// instantes: las capturas (a ~0, 300, 1500 y 6500 ms) son para el juicio visual.
type Borde = "arriba" | "izquierda" | "derecha" | "abajo";

async function cargar(page: Page, borde: Borde): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await page.evaluate((b) => {
    const mundo = window.__debug.mundo!;
    const sitio = {
      arriba: { x: mundo.ancho / 2, y: 60, angulo: 90 },
      izquierda: { x: 60, y: mundo.alto / 2, angulo: 180 },
      derecha: { x: mundo.ancho - 60, y: mundo.alto / 2, angulo: 0 },
      abajo: { x: mundo.ancho / 2, y: mundo.alto - 60, angulo: -90 },
    }[b];
    window.__debug.cargarEscenario!({
      naves: [
        { x: sitio.x, y: sitio.y, integridad: 150 },
        { x: mundo.ancho - sitio.x, y: mundo.alto - sitio.y, integridad: 150 },
      ],
      arma: "gancho-pegajoso",
      anguloGrados: sitio.angulo,
      potencia: 100,
    });
  }, borde);
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "gancho-pegajoso" && window.__debug.control!.puedeDisparar === true);
}

async function captura(page: Page, borde: Borde, ms: number): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/pegajosa-borde-${borde}-${ms}ms-360x640.png` });
}

for (const borde of ["arriba", "izquierda", "derecha", "abajo"] as const) {
  test(`peg-1: el gancho que sale por el borde ${borde} desaparece, sin cuenta atrás ni explosión`, async ({ page }) => {
    test.setTimeout(120000);
    await cargar(page, borde);
    const navesAntes = await page.evaluate(() => window.__debug.naves!.length);
    await page.getByTestId("disparar").click();
    await captura(page, borde, 0);
    await page.waitForFunction(() => window.__debug.avisoPerdido !== undefined, undefined, { timeout: 60000 });
    await captura(page, borde, 300);

    // Tras el disparo humano la IA juega su turno: proyectilEnVuelo y las
    // explosiones visibles pueden ser suyos, así que solo se miran los del
    // gancho (arma) y los del tirador 0.
    const leer = () =>
      page.evaluate(() => ({
        aviso: window.__debug.avisoPerdido?.borde ?? null,
        gancho: window.__debug.proyectilEnVuelo?.armaId === "gancho-pegajoso",
        cuenta: window.__debug.cuentaAtrasAdherencia ?? null,
        detonacionesPropias: (window.__debug.registroDetonaciones ?? []).filter((r) => r.tirador === 0).reduce((suma, r) => suma + r.cantidad, 0),
        naves: window.__debug.naves!.length,
      }));
    const tras = await leer();
    await page.waitForTimeout(1500);
    await captura(page, borde, 1500);
    // Más que los 5 s de la mecha: si el gancho estuviera pegado, ya habría explotado.
    await page.waitForTimeout(5000);
    await captura(page, borde, 6500);
    const final = await leer();

    expect(["arriba", "abajo", "izquierda", "derecha"]).toContain(tras.aviso);
    for (const medida of [tras, final]) {
      expect(medida.gancho).toBe(false);
      expect(medida.cuenta).toBeNull();
      expect(medida.detonacionesPropias).toBe(0);
      expect(medida.naves).toBe(navesAntes);
    }
  });
}
