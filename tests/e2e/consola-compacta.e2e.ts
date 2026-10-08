import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const VIEWPORTS = [
  { ancho: 360, alto: 640, anchoConsola: 320 },
  { ancho: 820, alto: 1180, anchoConsola: 328 },
  { ancho: 1180, alto: 820, anchoConsola: 472 },
];

async function entrarAPartida(page: Page, ancho: number, alto: number): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
}

async function caja(page: Page) {
  return (await page.getByTestId("consola").boundingBox())!;
}

for (const vp of VIEWPORTS) {
  test(`con-1: ${vp.ancho}x${vp.alto}, abajo al 40 %, se oculta, se mueve y se vuelve a mostrar para disparar`, async ({ page }) => {
    test.setTimeout(150000);
    await entrarAPartida(page, vp.ancho, vp.alto);

    const inicial = await caja(page);
    expect(Math.abs(inicial.width - vp.anchoConsola)).toBeLessThanOrEqual(2);
    expect(vp.alto - (inicial.y + inicial.height)).toBeLessThanOrEqual(8);
    expect(inicial.height).toBeLessThanOrEqual(vp.alto * 0.4 + 1);
    expect(Math.abs(inicial.x + inicial.width / 2 - vp.ancho / 2)).toBeLessThanOrEqual(2);
    const centro = { x: inicial.x + inicial.width / 2, y: inicial.y + inicial.height / 2 };

    await page.getByTestId("boton-ocultar-consola").click();
    await expect(page.getByTestId("pestana-consola")).toBeVisible();
    const tapa = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, centro);
    expect(tapa).toBe("CANVAS");
    const pestana = (await page.getByTestId("pestana-consola").boundingBox())!;
    expect(Math.round(pestana.width)).toBe(48);
    expect(Math.round(pestana.height)).toBe(48);
    await expect(page.getByTestId("disparar")).toBeHidden();
    expect(await page.evaluate(() => window.__debug.consola?.estado)).toBe("oculta");

    await page.getByTestId("pestana-consola").click();
    await expect(page.getByTestId("disparar")).toBeVisible();

    await page.getByTestId("boton-mover-consola").click();
    const izquierda = await caja(page);
    expect(izquierda.x).toBeLessThanOrEqual(16);
    expect(await page.evaluate(() => window.__debug.consola?.anclaje)).toBe("abajo-izquierda");
    await page.getByTestId("boton-mover-consola").click();
    const derecha = await caja(page);
    expect(vp.ancho - (derecha.x + derecha.width)).toBeLessThanOrEqual(16);
    expect(await page.evaluate(() => window.__debug.consola?.anclaje)).toBe("abajo-derecha");

    // Persistencia: tras recargar siguen el anclaje y el estado.
    await page.reload();
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await expect(page.getByTestId("consola")).toHaveAttribute("data-anclaje", "abajo-derecha");

    await page.waitForFunction(() => window.__debug.control?.puedeDisparar === true, undefined, { timeout: 60000 });
    if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
    const antes = await page.evaluate(() => window.__debug.resultadoTurno);
    await page.getByTestId("disparar").click();
    await page.waitForFunction((previo) => window.__debug.resultadoTurno !== previo, antes, { timeout: 90000 });
  });
}

test("con-1: un anclaje corrupto en localStorage arranca en abajo-centro y un estado oculto se conserva", async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.localStorage.setItem("consola:anclaje", "xyz");
    window.localStorage.setItem("consola:estado", "oculta");
  });
  await entrarAPartida(page, 360, 640);
  await expect(page.getByTestId("consola")).toHaveAttribute("data-anclaje", "abajo-centro");
  await expect(page.getByTestId("consola")).toHaveAttribute("data-estado", "oculta");
});

test("con-2: a 360x640 con la consola desplegada la última fila y el resumen no se cortan ni quedan tapados", async ({ page }) => {
  test.setTimeout(120000);
  await entrarAPartida(page, 360, 640);
  const resumen = await page.getByTestId("resultado-turno").evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(resumen).toBe(true);
  for (const id of ["selector-arma-abrir", "repetir-disparo", "disparar", "historico-bromas-toggle"]) {
    const c = (await page.getByTestId(id).boundingBox())!;
    const tapadoPor = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest("[data-testid]")?.getAttribute("data-testid") ?? null;
      },
      { x: c.x + c.width / 2, y: c.y + c.height / 2 },
    );
    expect(tapadoPor, `${id} tapado`).toBe(id);
  }
  await page.screenshot({ path: "capturas/consola-compacta-360x640-desplegada.png" });
});

test("con-3: botones nuevos con nombre accesible y ≥ 44×44, y axe sin violaciones serias en los tres estados", async ({ page }) => {
  test.setTimeout(120000);
  await entrarAPartida(page, 360, 640);
  async function axe(): Promise<string[]> {
    const r = await new AxeBuilder({ page }).include('[data-testid="consola"]').analyze();
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
  }
  for (const [id, nombre] of [["boton-mover-consola", "Mover controles"], ["boton-plegar-consola", "Reducir controles"], ["boton-ocultar-consola", "Ocultar controles"]] as const) {
    await expect(page.getByTestId(id)).toHaveAccessibleName(nombre);
    const c = (await page.getByTestId(id).boundingBox())!;
    expect(c.width).toBeGreaterThanOrEqual(44);
    expect(c.height).toBeGreaterThanOrEqual(44);
  }
  expect(await axe()).toEqual([]);

  await page.getByTestId("boton-plegar-consola").click();
  await expect(page.getByTestId("barra-minima")).toBeVisible();
  expect(await axe()).toEqual([]);

  await page.getByTestId("boton-plegar-consola").click();
  await page.getByTestId("boton-ocultar-consola").click();
  await expect(page.getByTestId("pestana-consola")).toHaveAccessibleName("Mostrar controles");
  const p = (await page.getByTestId("pestana-consola").boundingBox())!;
  expect(p.width).toBeGreaterThanOrEqual(44);
  expect(p.height).toBeGreaterThanOrEqual(44);
  expect(await axe()).toEqual([]);
});
