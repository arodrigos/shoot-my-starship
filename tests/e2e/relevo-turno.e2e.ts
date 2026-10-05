import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// relevo-turno: se juega por la pantalla de inicio real, en un mapa de suelo
// plano sembrado (deriva 0) donde existe la solución balística exacta y el
// apuntado es determinista.
const MAPA_SEMBRADO = "calma-de-los-restos";

async function empezar(page: Page, humanos: number, ias: number, todosVemosTodo = false): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId(`humanos-${humanos}`).click();
  await page.getByTestId(`ias-${ias}`).click();
  if (humanos > 1) {
    await page.getByTestId("nombre-jugador-0").pressSequentially("Ana");
    await page.getByTestId("nombre-jugador-1").pressSequentially("Luis");
  }
  if (todosVemosTodo) {
    await expect(page.getByTestId("aviso-todos-vemos-todo")).toHaveCount(0);
    await page.getByTestId("todos-vemos-todo").check();
    await expect(page.getByTestId("aviso-todos-vemos-todo")).toContainText("pública");
  }
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

async function esperarJugable(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
}

// Dispara el turno actual. `acertar` usa la solución exacta; si no, potencia
// mínima y ángulo medio, que no llega a ninguna nave.
async function disparar(page: Page, acertar: boolean): Promise<void> {
  await esperarJugable(page);
  const numeroTurno = await page.evaluate(() => window.__debug.numeroTurno!);
  let fraccionAngulo = 0.5;
  let fraccionPotencia = 0;
  if (acertar) {
    const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
    expect(solucion, "debe existir solución exacta en un mapa de deriva 0").not.toBeNull();
    fraccionAngulo = (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
    fraccionPotencia = (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
  }
  await arrastrarBarraHasta(page, "barra-angulo", fraccionAngulo);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionPotencia);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((anterior) => (window.__debug.numeroTurno ?? 0) > anterior, numeroTurno, { timeout: 30000 });
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 30000 });
}

test("relevo-turno-1/2/3/6: entre dos humanos el relevo bloquea el juego, oculta lo privado y resume el turno", async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page, 2, 0);

  // Ana acierta: el relevo de Luis enseña el resumen con daño y arma, y una broma.
  await disparar(page, true);
  const relevo = page.getByTestId("pantalla-relevo");
  await expect(relevo).toBeVisible();
  await expect(page.getByTestId("relevo-jugador")).toHaveText("Turno de Luis");
  const resumen = (await page.getByTestId("relevo-resumen").textContent()) ?? "";
  expect(resumen).toMatch(/^Ana ha disparado .+ y ha hecho [1-9]\d* de daño\.$/);
  await expect(page.getByTestId("relevo-broma")).not.toBeEmpty();

  // relevo-turno-1: nada apuntable ni disparable hasta confirmar.
  expect(await page.evaluate(() => window.__debug.control!.puedeDisparar)).toBe(false);
  await expect(page.getByTestId("disparar")).toHaveCount(0);
  await expect(page.getByTestId("barra-angulo")).toHaveCount(0);

  // relevo-turno-2: ni saldo ni armas del jugador anterior en el DOM.
  await expect(page.getByTestId("saldo")).toHaveCount(0);
  await expect(page.getByTestId("selector-arma-abrir")).toHaveCount(0);
  await expect(page.locator('[data-testid^="arma-"]')).toHaveCount(0);

  // relevo-turno-6: objetivos táctiles y contraste de la pantalla de relevo.
  const axe = await new AxeBuilder({ page }).withRules(["target-size", "color-contrast"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: "test-results/relevo-turno/relevo-turno-01-relevo-360x640.png" });

  await page.getByTestId("relevo-confirmar").click();
  await expect(relevo).toHaveCount(0);
  await esperarJugable(page);
  expect(await page.evaluate(() => window.__debug.turno)).toBe(1);
  // Y al empezar el turno siguiente tampoco aparece lo del anterior.
  await expect(page.getByTestId("saldo")).toHaveCount(0);

  // relevo-turno-3, caso de fallo: Luis dispara sin alcanzar a nadie.
  await disparar(page, false);
  await expect(relevo).toBeVisible();
  await expect(page.getByTestId("relevo-jugador")).toHaveText("Turno de Ana");
  await expect(page.getByTestId("relevo-resumen")).toHaveText(/^Luis ha fallado con .+\.$/);
});

test("relevo-turno-4: sin relevo con un solo humano, ni 1vIA ni 1 humano más 3 IA", async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page, 1, 3);
  // Se observa el DOM en cada turno humano: tras cada disparo juegan las tres
  // IA y el turno vuelve al humano sin que aparezca ningún relevo.
  for (let i = 0; i < 2; i++) {
    await disparar(page, false);
    await esperarJugable(page);
    await expect(page.getByTestId("pantalla-relevo")).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.__debug.turno)).toBe(0);

  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForFunction(() => window.__debug?.control !== undefined && window.__debug.terreno?.listo === true);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await disparar(page, false);
  await esperarJugable(page);
  await expect(page.getByTestId("pantalla-relevo")).toHaveCount(0);
});

test("relevo-turno-5: con «todos vemos todo» el turno pasa directo", async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page, 2, 0, true);
  await disparar(page, true);
  await esperarJugable(page);
  await expect(page.getByTestId("pantalla-relevo")).toHaveCount(0);
  expect(await page.evaluate(() => window.__debug.turno)).toBe(1);
});
