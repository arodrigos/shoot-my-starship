import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// tg-3 (consola desplegada): con «Texto grande» los controles de disparo tienen que
// quedar dentro de la pantalla y recibir el toque, no solo las pestañas de vida.
const MAPA_SEMBRADO = "calma-de-los-restos";
const TAMANOS = [
  { width: 360, height: 640 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
] as const;

const CONTROLES = ["selector-arma-abrir", "disparar", "repetir-disparo"] as const;

async function empezar(page: Page, tam: { width: number; height: number }, ias: number): Promise<void> {
  await page.setViewportSize(tam);
  await page.addInitScript(() => localStorage.setItem("legibilidad:texto-grande", "1"));
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("humanos-1").click();
  await page.getByTestId(`ias-${ias}`).click();
  await page.getByTestId("reloj-30").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await expect(page.getByTestId("consola")).toHaveAttribute("data-estado", "desplegada");
}

for (const tam of TAMANOS) {
  for (const ias of [1, 3]) {
    test(`tg-3 consola: Disparar, Repetir y el selector de arma dentro y pulsables (${tam.width}x${tam.height}, ${ias} IA)`, async ({ page }) => {
      test.setTimeout(180000);
      mkdirSync("capturas", { recursive: true });
      await empezar(page, tam, ias);
      const medidas = await page.evaluate(
        ({ ids, ancho, alto }) =>
          ids.map((id) => {
            const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
            if (el === null) return { id, presente: false, dentro: false, recibeToque: false, caja: null };
            const r = el.getBoundingClientRect();
            const x = r.x + r.width / 2;
            const y = r.y + r.height / 2;
            const dentro = r.left >= 0 && r.top >= 0 && r.right <= ancho && r.bottom <= alto;
            const tocado = document.elementFromPoint(x, y);
            return { id, presente: true, dentro, recibeToque: tocado !== null && el.contains(tocado), caja: [r.left, r.top, r.right, r.bottom] };
          }),
        { ids: [...CONTROLES], ancho: tam.width, alto: tam.height },
      );
      await page.screenshot({ path: `capturas/consola-texto-grande-${tam.width}x${tam.height}-${ias}ia.png` });
      for (const m of medidas) {
        expect(m.presente, `${m.id} montado`).toBe(true);
        expect(m.dentro, `${m.id} dentro del viewport ${JSON.stringify(m.caja)}`).toBe(true);
        expect(m.recibeToque, `${m.id} recibe el toque en su centro`).toBe(true);
      }
    });
  }
}
