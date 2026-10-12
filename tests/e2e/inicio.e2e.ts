import { test, expect, type Page } from "@playwright/test";

// ini-1 / ini-2: pantalla de inicio sin scroll y pestañas de jugador enteras,
// en el móvil y en el iPad (vertical y horizontal).
const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
] as const;

async function capturar(page: Page, nombre: string, ancho: number, alto: number): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nombre}-${ancho}x${alto}.png` });
}

async function esperarPartida(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug?.naves !== undefined && window.__debug?.musica !== undefined, undefined, { timeout: 120000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

for (const { ancho, alto } of TAMANOS) {
  test(`ini-1: «Jugar» y «Música» se ven sin scroll y la música elegida llega a la partida (${ancho}x${alto})`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/");
    await expect(page.getByTestId("pantalla-inicio")).toBeVisible();

    const medidas = await page.evaluate(() => {
      const caja = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      const inicio = document.querySelector('[data-testid="pantalla-inicio"]')!;
      return { scrollY: window.scrollY, scrollInterno: inicio.scrollTop, alto: window.innerHeight, jugar: caja("boton-jugar"), musica: caja("inicio-toggle-musica") };
    });
    expect(medidas.scrollY).toBe(0);
    expect(medidas.scrollInterno).toBe(0);
    for (const caja of [medidas.jugar, medidas.musica]) {
      expect(caja.top).toBeGreaterThanOrEqual(0);
      expect(caja.bottom).toBeLessThanOrEqual(medidas.alto);
    }
    await capturar(page, "ini-1-inicio", ancho, alto);

    const musica = page.getByTestId("inicio-toggle-musica");
    await expect(musica).toHaveAttribute("aria-pressed", "true");
    await musica.click();
    await expect(musica).toHaveAttribute("aria-pressed", "false");

    // Recargar: la elección persiste y el inicio la muestra apagada.
    await page.reload();
    await expect(page.getByTestId("inicio-toggle-musica")).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("boton-jugar").click();
    await esperarPartida(page);
    await expect(page.getByTestId("toggle-musica")).toHaveAttribute("aria-pressed", "false");
    expect((await page.evaluate(() => window.__debug.musica!())).estado).toBe("parada");
  });

  test(`ini-2: con 4 jugadores las pestañas se leen enteras, con su vida (${ancho}x${alto})`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/");
    await page.getByTestId("humanos-4").click();
    const nombres = ["Capitana Sobrenombre", "0123456789ABCDEF", "Ana", "Luis"];
    for (const [i, nombre] of nombres.entries()) await page.getByTestId(`nombre-jugador-${i}`).fill(nombre);
    await page.getByTestId("boton-jugar").click();
    await esperarPartida(page);

    for (let id = 0; id < 4; id++) {
      const pestana = page.getByTestId(`integridad-nave-${id}`);
      const m = await pestana.evaluate((el) => {
        const caja = el.getBoundingClientRect();
        const etiqueta = el.firstElementChild!;
        return {
          izq: caja.left,
          der: caja.right,
          cortada: el.scrollWidth > el.clientWidth || etiqueta.scrollWidth > etiqueta.clientWidth,
          ancho: window.innerWidth,
          detalle: `${el.scrollWidth}/${el.clientWidth}, etiqueta ${etiqueta.scrollWidth}/${etiqueta.clientWidth}`,
        };
      });
      expect(m.izq, `pestaña ${id} fuera por la izquierda`).toBeGreaterThanOrEqual(0);
      expect(m.der, `pestaña ${id} fuera por la derecha`).toBeLessThanOrEqual(m.ancho);
      expect(m.cortada, `pestaña ${id} cortada (${m.detalle})`).toBe(false);
      // Vida visible, con el nombre completo accesible aunque se abrevie.
      await expect(pestana.getByRole("progressbar", { name: `Integridad de ${nombres[id].slice(0, 16)}` })).toHaveAttribute("aria-valuenow", "150");
      await expect(pestana).toContainText(nombres[id].slice(0, 16));
    }
    await capturar(page, "ini-2-pestanas", ancho, alto);
  });
}
