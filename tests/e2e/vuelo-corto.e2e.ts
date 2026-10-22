import { test, expect, type Page } from "@playwright/test";
import { DISTANCIA_MINIMA_PROPULSORES_PX, LARGO_NAVE_U } from "@/juego/control/vueloPropulsores";

// Con los propulsores, un vuelo previsto que no supera el largo de la nave
// muestra el aviso de vuelo corto pero deja lanzar; uno más largo no avisa.
async function abrirPropulsores(page: Page, semilla: number): Promise<void> {
  await page.goto(`/?semilla=${semilla}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId("equipo-propulsores").click();
  await expect(page.getByTestId("disparar")).toHaveText("Encender propulsores");
}

// La colocación depende de la semilla y del tamaño de pantalla: con estas, la
// nave del jugador queda pegada a un planeta y algún rumbo da un salto corto
// (con la semilla por defecto, a 820x1180 todos los vuelos pasan de 100 u).
const TAMANOS = [
  { w: 360, h: 640, semilla: 4 },
  { w: 820, h: 1180, semilla: 1 },
  { w: 1180, h: 820, semilla: 1 },
];

for (const t of TAMANOS) {
  test(`aviso de vuelo corto con propulsores (${t.w}x${t.h})`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: t.w, height: t.h });
    await abrirPropulsores(page, t.semilla);

    let corto = false;
    let largo = false;
    for (const potencia of [5, 100]) {
      for (let grados = 0; grados < 360; grados += 10) {
        if (corto && largo) break;
        await page.evaluate(({ g, p }) => {
          window.__debug.previsualizacionPropulsores = null;
          window.__debug.fijarApuntado!(g, p);
        }, { g: grados, p: potencia });
        await page.waitForFunction(() => window.__debug.previsualizacionPropulsores != null);
        const { motivo, distancia } = await page.evaluate(() => {
          const previa = window.__debug.previsualizacionPropulsores!;
          const fin = previa.puntos[previa.puntos.length - 1];
          const nave = window.__debug.naves![0];
          return { motivo: previa.motivo, distancia: Math.hypot(fin.x - nave.x, fin.y - (nave.y as number)) };
        });
        if (motivo === "obstaculo" && distancia < DISTANCIA_MINIMA_PROPULSORES_PX) continue;
        if (distancia <= LARGO_NAVE_U && !corto) {
          corto = true;
          await expect(page.getByTestId("aviso-vuelo-corto")).toBeVisible();
          await expect(page.getByTestId("aviso-vuelo-corto")).toHaveText("Vuelo corto: la nave apenas se mueve.");
          await expect(page.getByTestId("disparar")).toBeEnabled();
          await page.screenshot({ path: `capturas/vuelo-corto-aviso-${t.w}x${t.h}.png` });
        } else if (distancia > LARGO_NAVE_U && !largo) {
          largo = true;
          await expect(page.getByTestId("aviso-vuelo-corto")).toHaveCount(0);
          await expect(page.getByTestId("disparar")).toBeEnabled();
        }
      }
    }
    expect(corto).toBe(true);
    expect(largo).toBe(true);
  });
}
