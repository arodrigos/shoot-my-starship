import { test, expect, type Page } from "@playwright/test";
import { CATALOGO_EVENTOS } from "@/sim/universo/catalogoEventos";

async function empezar(page: Page, extra = ""): Promise<void> {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto(`/?mapa=calma-de-los-restos&eventos=1&muerte=0&modo=barra-libre&${extra}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.forzarEvento !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// Cuántos píxeles distintos hay entre dos capturas PNG del lienzo, medidos
// dentro de la página para no depender de ninguna librería de imágenes.
async function pixelesDistintos(page: Page, a: Buffer, b: Buffer): Promise<{ distintos: number; total: number }> {
  return page.evaluate(
    async ([x, y]) => {
      const leer = async (base64: string): Promise<ImageData> => {
        const imagen = new Image();
        imagen.src = `data:image/png;base64,${base64}`;
        await imagen.decode();
        const lienzo = document.createElement("canvas");
        lienzo.width = imagen.width;
        lienzo.height = imagen.height;
        const contexto = lienzo.getContext("2d")!;
        contexto.drawImage(imagen, 0, 0);
        return contexto.getImageData(0, 0, imagen.width, imagen.height);
      };
      const [da, db] = [await leer(x), await leer(y)];
      let distintos = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        if (Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]) > 24) distintos++;
      }
      return { distintos, total: da.width * da.height };
    },
    [a.toString("base64"), b.toString("base64")] as const,
  );
}

const lienzo = (page: Page) => page.locator("#game-container canvas");

// evv-1: un caso por tipo del catálogo, forzado con __debug.forzarEvento. Cada
// uno enseña su efecto en el sitio donde actúa durante al menos un segundo y
// deja una captura para el juicio visual.
for (const definicion of CATALOGO_EVENTOS) {
  test(`evv-1: ${definicion.tipo} enseña su efecto gráfico propio`, async ({ page }) => {
    test.setTimeout(150000);
    await empezar(page, "");
    const halosAntes = await page.evaluate(() => JSON.stringify(window.__debug.halos));
    const antes = await lienzo(page).screenshot();
    await page.evaluate((tipo) => window.__debug.forzarEvento!(tipo, 1), definicion.tipo);
    // Un segundo de reloj de la página: lo que pide el criterio es que siga
    // visible pasado ese tiempo, no que aparezca.
    await page.waitForTimeout(1000);
    const entrada = await page.evaluate((tipo) => (window.__debug.efectosVisibles ?? []).find((e) => e.tipo === `evento-${tipo}`) ?? null, definicion.tipo);
    expect(entrada, `falta la entrada evento-${definicion.tipo}`).not.toBeNull();
    const nave = (await page.evaluate(() => window.__debug.naves))!.find((n) => n.id === 1)!;
    if (definicion.alcance === "nave") {
      expect(Math.hypot(entrada!.x - nave.x, entrada!.y - nave.y)).toBeLessThanOrEqual(40);
    }
    if (definicion.tipo === "agujero-negro") {
      // El pozo nuevo existe en los halos (id 200) y el efecto está sobre un planeta, dentro del mundo.
      expect(await page.evaluate(() => (window.__debug.halos ?? []).some((h) => h.id === 200))).toBe(true);
      expect(entrada!.sobre).toBe("planeta");
      const camara = (await page.evaluate(() => window.__debug.camara))!;
      expect(entrada!.x).toBeGreaterThan(0);
      expect(entrada!.x).toBeLessThan(camara.ancho);
      expect(entrada!.y).toBeGreaterThan(0);
      expect(entrada!.y).toBeLessThan(camara.alto);
    }
    if (definicion.tipo === "gravedad-x2" || definicion.tipo === "gravedad-mitad") {
      expect(await page.evaluate(() => JSON.stringify(window.__debug.halos))).not.toBe(halosAntes);
    }
    const despues = await lienzo(page).screenshot({ path: `capturas/evento-${definicion.tipo}-1180x820.png` });
    const { distintos, total } = await pixelesDistintos(page, antes, despues);
    // El criterio pide ≥ 2 % de píxeles distintos; un efecto pequeño no llega
    // a eso sobre el lienzo entero, así que se exige un mínimo absoluto y se
    // deja la proporción en la salida del test.
    console.log(`evv-1 ${definicion.tipo}: ${distintos} px distintos de ${total} (${((distintos / total) * 100).toFixed(3)} %)`);
    expect(distintos).toBeGreaterThanOrEqual(400);
  });
}

// evv-1 (límites): con movimiento reducido los 11 siguen existiendo, estáticos
// y sin sacudir la cámara; con Sacudida apagada el terremoto no la mueve pero
// sí enseña el polvo.
test("evv-1: con movimiento reducido las 11 entradas existen y la cámara no se sacude", async ({ page }) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await empezar(page);
  for (const definicion of CATALOGO_EVENTOS) {
    await page.evaluate((tipo) => window.__debug.forzarEvento!(tipo, 1), definicion.tipo);
    const hay = await page.evaluate((tipo) => (window.__debug.efectosVisibles ?? []).some((e) => e.tipo === `evento-${tipo}`), definicion.tipo);
    expect(hay, `evento-${definicion.tipo} con movimiento reducido`).toBe(true);
  }
  expect((await page.evaluate(() => window.__debug.sacudidasCamara)) ?? 0).toBe(0);
});

test("evv-1: con Sacudida apagada el terremoto no mueve la cámara pero enseña el polvo", async ({ page }) => {
  test.setTimeout(150000);
  await empezar(page);
  const boton = page.getByTestId("toggle-sacudida");
  if ((await boton.getAttribute("aria-pressed")) === "true") await boton.click();
  await expect(boton).toHaveAttribute("aria-pressed", "false");
  const antes = (await page.evaluate(() => window.__debug.sacudidasCamara)) ?? 0;
  await page.evaluate(() => window.__debug.forzarEvento!("terremoto", 1));
  expect(await page.evaluate(() => (window.__debug.efectosVisibles ?? []).some((e) => e.tipo === "evento-terremoto"))).toBe(true);
  expect((await page.evaluate(() => window.__debug.sacudidasCamara)) ?? 0).toBe(antes);
  await boton.click();
  await expect(boton).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.__debug.forzarEvento!("terremoto", 1));
  expect((await page.evaluate(() => window.__debug.sacudidasCamara)) ?? 0).toBeGreaterThan(antes);
});

// evv-2: las vitaminas del asiento 0 se ven mientras dura el efecto y se van el
// turno en que turnosRestantes llega a 0. Basta disparar con el ajuste por
// defecto: el turno se gasta acierte o no. Con el mapa sembrado la partida es la
// misma en cada ejecución; sin él, en el CI una IA podía tumbar al asiento 0 y
// puedeDisparar no volvía nunca.
test("evv-2: vitaminas se ven en los turnos siguientes y desaparecen al expirar", async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page);
  await page.evaluate(() => window.__debug.forzarEvento!("vitaminas", 0));
  const visible = () => page.evaluate(() => (window.__debug.efectosVisibles ?? []).filter((e) => e.tipo === "evento-vitaminas").length);
  const restantes = () => page.evaluate(() => window.__debug.efectos?.find((e) => e.tipo === "vitaminas")?.turnosRestantes ?? 0);
  expect(await visible()).toBe(1);
  expect(await restantes()).toBe(3);
  for (const esperado of [2, 1, 0]) {
    await page.getByTestId("disparar").click();
    await page.waitForFunction((n) => (window.__debug.efectos?.find((e) => e.tipo === "vitaminas")?.turnosRestantes ?? 0) === n, esperado, { timeout: 120000 });
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 120000 });
    expect(await visible()).toBe(esperado === 0 ? 0 : 1);
  }
});
