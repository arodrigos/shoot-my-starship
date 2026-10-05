import { test, expect, type Page } from "@playwright/test";

// multi-setup-partida-2/3: la partida que sale al pulsar Jugar, en modo
// espacial y sin ?mapa= (el e2e anterior solo jugaba el mapa de suelo, donde
// la colocación nunca caía al último recurso). Las naves tienen que quedar
// dentro del lienzo visible, distinguibles entre sí y fuera de los botones
// del HUD.
async function esperarPartida(page: Page): Promise<void> {
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.naves !== undefined && window.__debug.camara !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

for (const humanos of [3, 4]) {
  test(`multi-setup-partida-3: ${humanos} naves en la partida espacial por defecto quedan dentro del lienzo y fuera de los botones a 360x640`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/");
    await page.getByTestId(`humanos-${humanos}`).click();
    await page.getByTestId("boton-jugar").click();
    await esperarPartida(page);

    const { naves, camara } = await page.evaluate(() => ({ naves: window.__debug.naves!, camara: window.__debug.camara! }));
    expect(naves).toHaveLength(humanos);
    const lienzo = await page.locator("#game-container canvas").boundingBox();
    expect(lienzo).not.toBeNull();
    const escala = lienzo!.width / camara.ancho;
    const enPantalla = naves.map((nave) => ({
      id: nave.id,
      x: lienzo!.x + (nave.x - camara.x) * escala,
      y: lienzo!.y + (nave.y - camara.y) * escala,
    }));

    // Radio de casco de ~22 px de mundo, a escala de pantalla.
    const radioPantalla = 22 * escala;
    const diagnostico = JSON.stringify({ lienzo, camara, enPantalla });
    for (const nave of enPantalla) {
      expect(nave.x - radioPantalla, `nave ${nave.id} fuera por la izquierda: ${diagnostico}`).toBeGreaterThanOrEqual(lienzo!.x);
      expect(nave.x + radioPantalla, `nave ${nave.id} fuera por la derecha: ${diagnostico}`).toBeLessThanOrEqual(lienzo!.x + lienzo!.width);
      expect(nave.y - radioPantalla, `nave ${nave.id} fuera por arriba: ${diagnostico}`).toBeGreaterThanOrEqual(lienzo!.y);
      expect(nave.y + radioPantalla, `nave ${nave.id} fuera por abajo: ${diagnostico}`).toBeLessThanOrEqual(lienzo!.y + lienzo!.height);
    }

    for (const idBoton of ["historico-bromas-toggle", "toggle-sacudida", "toggle-silenciado"]) {
      const caja = await page.getByTestId(idBoton).boundingBox();
      expect(caja, `el botón ${idBoton} tiene que estar visible`).not.toBeNull();
      for (const nave of enPantalla) {
        const solapa =
          nave.x + radioPantalla > caja!.x &&
          nave.x - radioPantalla < caja!.x + caja!.width &&
          nave.y + radioPantalla > caja!.y &&
          nave.y - radioPantalla < caja!.y + caja!.height;
        expect(solapa, `la nave ${nave.id} queda bajo el botón ${idBoton}: ${diagnostico}`).toBe(false);
      }
    }

    // Distinguibles: ningún par de naves a menos de un casco de distancia.
    for (const [i, a] of enPantalla.entries()) {
      for (const b of enPantalla.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y), `naves ${a.id} y ${b.id} solapadas: ${diagnostico}`).toBeGreaterThan(2 * radioPantalla);
      }
    }

    await page.screenshot({ path: `test-results/multi-setup-colocacion/multi-setup-colocacion-${humanos}-naves-360x640.png` });
  });
}
