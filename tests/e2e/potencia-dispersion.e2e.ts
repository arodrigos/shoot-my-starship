import { test, expect } from "@playwright/test";
import { arrastrarBarraHasta } from "./utilesControl";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { UMBRAL_POTENCIA_DISPERSION_VISIBLE } from "@/sim/balistica/dispersionPotencia";

async function entrarAPartida(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

function fraccionDePotencia(porcentaje: number): number {
  return (porcentaje - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
}

function fraccionDeAngulo(grados: number): number {
  return (grados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
}

// potencia-dispersion-3 (camino crítico): el cono de dispersión se muestra
// antes de disparar y el impacto cae DENTRO de lo mostrado -- se comprueba
// que el ángulo con el que de verdad vuela el proyectil (derivado de su
// velocidad inicial real, tras la dispersión) queda entre los dos extremos
// que la banda anunció, nunca fuera.
test("potencia-dispersion-3: el disparo real cae dentro del cono de dispersión mostrado antes de disparar", async ({ page }) => {
  test.setTimeout(60000);
  await entrarAPartida(page);

  await arrastrarBarraHasta(page, "barra-angulo", fraccionDeAngulo(55));
  await page.waitForFunction((esperado) => Math.abs(window.__debug.control!.ajuste.anguloGrados - esperado) <= 1, 55);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(95));
  await page.waitForFunction((esperado) => Math.abs(window.__debug.control!.ajuste.potencia - esperado) <= 1, 95);

  await page.waitForFunction(() => (window.__debug.bandaDispersion?.extremoMenor.length ?? 0) >= 2, undefined, { timeout: 10000 });
  const bandaAntes = await page.evaluate(() => window.__debug.bandaDispersion);
  expect(bandaAntes).toBeTruthy();
  expect(bandaAntes!.amplitudGrados).toBeGreaterThan(0);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.ultimoDisparo?.inicial !== undefined, undefined, { timeout: 30000 });

  const disparo = await page.evaluate(() => window.__debug.ultimoDisparo);
  const inicial = disparo!.inicial!;
  const anguloRealGrados = (Math.atan2(-inicial.vy, inicial.vx) * 180) / Math.PI;

  const amplitud = bandaAntes!.amplitudGrados;
  const anguloPedido = 55;
  expect(anguloRealGrados).toBeGreaterThanOrEqual(anguloPedido - amplitud - 0.5);
  expect(anguloRealGrados).toBeLessThanOrEqual(anguloPedido + amplitud + 0.5);
});

// potencia-dispersion-6: la ayuda aparece la primera vez que se cruza el
// umbral, y no reaparece en los turnos siguientes de la misma partida.
test("potencia-dispersion-6: la ayuda de dispersión aparece una vez por partida al cruzar el umbral", async ({ page }) => {
  test.setTimeout(60000);
  await entrarAPartida(page);

  await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(20));
  await page.waitForFunction((p) => Math.abs(window.__debug.control!.ajuste.potencia - p) <= 2, 20);
  await expect(page.getByTestId("ayuda-dispersion")).toBeHidden();

  await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(UMBRAL_POTENCIA_DISPERSION_VISIBLE + 10));
  await page.waitForFunction(
    (p) => Math.abs(window.__debug.control!.ajuste.potencia - p) <= 2,
    UMBRAL_POTENCIA_DISPERSION_VISIBLE + 10,
  );
  await expect(page.getByTestId("ayuda-dispersion")).toBeVisible();

  // Se dispara (la ayuda se retira al disparar) y, ya en el turno
  // siguiente, se vuelve a cruzar el umbral: no debe reaparecer.
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await expect(page.getByTestId("ayuda-dispersion")).toBeHidden();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });

  await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(20));
  await page.waitForFunction((p) => Math.abs(window.__debug.control!.ajuste.potencia - p) <= 2, 20);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(UMBRAL_POTENCIA_DISPERSION_VISIBLE + 10));
  await page.waitForFunction(
    (p) => Math.abs(window.__debug.control!.ajuste.potencia - p) <= 2,
    UMBRAL_POTENCIA_DISPERSION_VISIBLE + 10,
  );
  await expect(page.getByTestId("ayuda-dispersion")).toBeHidden();
});
