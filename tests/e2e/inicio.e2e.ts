import { test, expect, type Page } from "@playwright/test";
import { abrirAjustes } from "./utilesControl";

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
    await abrirAjustes(page);
    await expect(page.getByTestId("toggle-musica")).toHaveAttribute("aria-pressed", "false");
    expect((await page.evaluate(() => window.__debug.musica!())).estado).toBe("parada");
  });

  // ini-2: se prueba con los nombres reales del juego y con cada composición
  // de asientos, porque el recorte salía del JS (nombre ya acortado) y un
  // scrollWidth <= clientWidth no lo detecta: se comprueba el texto visible.
  const CASOS = [
    { id: "1v1", humanos: 1, ias: 1, visibles: ["Tu nave", "Contable"], completos: ["Tu nave", "La Contable · Normal"] },
    { id: "1h2ia", humanos: 1, ias: 2, visibles: ["Jugador 1", "Contable", "Bisagra"], completos: ["Jugador 1", "La Contable · Normal", "Bisagra · Normal"] },
    { id: "1h3ia", humanos: 1, ias: 3, visibles: ["J1", "Contable", "Bisagra", "Chispa"], completos: ["Jugador 1", "La Contable · Normal", "Bisagra · Normal", "Chispa · Normal"] },
    { id: "4h", humanos: 4, ias: 0, visibles: ["J1", "J2", "J3", "J4"], completos: ["Jugador 1", "Jugador 2", "Jugador 3", "Jugador 4"] },
  ] as const;

  for (const caso of CASOS) {
    test(`ini-2: pestañas enteras con nombres reales, ${caso.id} (${ancho}x${alto})`, async ({ page }) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width: ancho, height: alto });
      await page.goto("/");
      if (caso.humanos > 1 || caso.ias > 1) {
        await page.getByTestId(`humanos-${caso.humanos}`).click();
        await page.getByTestId(`ias-${caso.ias}`).click();
      }
      await page.getByTestId("boton-jugar").click();
      await esperarPartida(page);

      for (let id = 0; id < caso.visibles.length; id++) {
        const pestana = page.getByTestId(`integridad-nave-${id}`);
        const m = await pestana.evaluate((el) => {
          const caja = el.getBoundingClientRect();
          const etiqueta = el.firstElementChild!;
          const visible = etiqueta.querySelector('span[aria-hidden="true"]')!.textContent ?? "";
          // El desborde de una fracción de píxel no lo ve scrollWidth (redondea):
          // se mide el contenido real con decimales (regresión r9, 0,3 px).
          const rango = document.createRange();
          // Solo lo visible: el span de lectores de pantalla desborda a propósito.
          rango.setStartBefore(etiqueta.firstChild!);
          rango.setEndAfter(etiqueta.querySelector('span[aria-hidden="true"]')!);
          const holgura = etiqueta.getBoundingClientRect().right - rango.getBoundingClientRect().right;
          return {
            holgura,
            izq: caja.left,
            der: caja.right,
            cortada: el.scrollWidth > el.clientWidth || etiqueta.scrollWidth > etiqueta.clientWidth,
            ancho: window.innerWidth,
            visible,
            detalle: `${el.scrollWidth}/${el.clientWidth}, etiqueta ${etiqueta.scrollWidth}/${etiqueta.clientWidth}`,
          };
        });
        expect(m.izq, `pestaña ${id} fuera por la izquierda`).toBeGreaterThanOrEqual(0);
        expect(m.der, `pestaña ${id} fuera por la derecha`).toBeLessThanOrEqual(m.ancho);
        expect(m.cortada, `pestaña ${id} cortada (${m.detalle})`).toBe(false);
        expect(m.holgura, `pestaña ${id}: holgura del nombre en px`).toBeGreaterThanOrEqual(0.5);
        expect(m.visible, `texto visible de la pestaña ${id}`).toBe(caso.visibles[id]);
        // Vida visible y nombre completo (sin recortar) accesible aunque se abrevie.
        await expect(pestana.getByRole("progressbar", { name: `Integridad de ${caso.completos[id]}` })).toHaveAttribute("aria-valuenow", "150");
      }
      await capturar(page, `ini-2-pestanas-${caso.id}`, ancho, alto);
    });
  }
}
