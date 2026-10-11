import { test, expect, type Page } from "@playwright/test";

// naves-nunca-dentro (inc-1): tras un impacto que empuja a la nave contra un
// planeta, la nave acaba apoyada fuera y su silueta entera libre de sólido.
// Las aserciones leen la máscara real; las capturas (antes, ~250 ms y ~1000 ms
// del impacto) son para el juicio visual.
type Tamano = { ancho: number; alto: number };
const TAMANOS: Tamano[] = [{ ancho: 360, alto: 640 }, { ancho: 820, alto: 1180 }, { ancho: 1180, alto: 820 }];

async function captura(page: Page, ms: string, t: Tamano): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/incrustacion-${ms}-${t.ancho}x${t.alto}.png` });
}

for (const tamano of TAMANOS) {
  test(`inc-1: el rival pegado al planeta no queda dentro tras el Pepinazo a ${tamano.ancho}x${tamano.alto}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: tamano.ancho, height: tamano.alto });
    await page.goto("/?modo=barra-libre");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined && (window.__debug.planetas?.length ?? 0) > 0);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });

    // El rival 40 u sobre el planeta más grande, el tirador justo encima y el
    // Pepinazo hacia abajo: el empuje lo mete contra la superficie.
    const rival = await page.evaluate(() => {
      const mundo = window.__debug.mundo!;
      const planeta = [...window.__debug.planetas!].sort((a, b) => b.radio - a.radio)[0];
      const y = planeta.cy - planeta.radio - 40;
      const tiradorY = Math.max(90, y - 260);
      window.__debug.cargarEscenario!({
        naves: [
          { x: planeta.cx, y: tiradorY, integridad: 150 },
          { x: planeta.cx, y, integridad: 150 },
        ],
        arma: "pepinazo-cortesia",
        anguloGrados: -90,
        potencia: 60,
      });
      return { x: planeta.cx, y, ancho: mundo.ancho };
    });
    await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "pepinazo-cortesia" && window.__debug.control!.puedeDisparar === true);
    await captura(page, "antes", tamano);
    await page.getByTestId("disparar").click();
    await page.waitForTimeout(250);
    await captura(page, "250ms", tamano);
    // Tras el disparo la IA juega su turno: se espera a que vuelva el humano.
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
    await page.waitForTimeout(1000);
    await captura(page, "1000ms", tamano);

    const solidos = await page.evaluate(() => {
      const puntos: { x: number; y: number }[] = [];
      for (const nave of window.__debug.naves!) {
        if (nave.integridad <= 0) continue;
        puntos.push({ x: nave.x, y: nave.y });
        for (let grados = 0; grados < 360; grados += 45) {
          puntos.push({ x: nave.x + 22 * Math.cos((grados * Math.PI) / 180), y: nave.y + 22 * Math.sin((grados * Math.PI) / 180) });
        }
      }
      return window.__debug.terreno!.comprobarPuntos(puntos);
    });
    expect(rival.ancho).toBeGreaterThan(0);
    expect(solidos.every((dentro) => dentro === false)).toBe(true);
  });
}
