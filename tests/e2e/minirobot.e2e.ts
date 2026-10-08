import { test, expect } from "@playwright/test";
import { arrastrarDesdeNave, plegarConsola } from "./utilesApuntado";
import { abrirSelector } from "./utilesCompra";

// rob-2: a 360x640 el robot se ve con su contador de saltos y el selector
// explica qué hace. Se coloca la nave justo encima de un planeta y se dispara
// hacia abajo: el robot se agarra a él (no hay ningún casco en esa dirección).
test("minirobot: tras dispararlo se ve el robot con su contador y el selector explica qué hace", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();

  await abrirSelector(page);
  await expect(page.getByTestId("ayuda-arma-minirobot-saltaplanetas")).toHaveText(
    "Salta de planeta en planeta hacia tu objetivo y explota encima (máx. 4 saltos).",
  );
  await page.getByTestId("arma-minirobot-saltaplanetas").click();

  const colocada = await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    const planetas = window.__debug.planetas ?? [];
    const naves = window.__debug.naves ?? [];
    for (const planeta of planetas) {
      const x = planeta.cx;
      const y = planeta.cy - planeta.radio - 70;
      if (x < 80 || x > mundo.ancho - 80 || y < 80) continue;
      if (window.__debug.terreno!.esSolido(Math.round(x), Math.round(y))) continue;
      const otraCerca = naves.some((nave) => nave.id !== 0 && Math.hypot(nave.x - x, (nave.y as number) - y) < 150);
      if (otraCerca) continue;
      window.__debug.forzarPosicionNave!(0, x, y);
      return true;
    }
    return false;
  });
  expect(colocada, "hace falta un planeta con hueco encima para colocar la nave").toBe(true);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
  await plegarConsola(page);
  await arrastrarDesdeNave(page, 0, 270, 40);
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes, { timeout: 60000 });

  await page.waitForFunction(() => (window.__debug.robots?.length ?? 0) === 1, undefined, { timeout: 30000 });
  // El aviso del HUD vive dentro de la consola: se pliega para apuntar y se
  // despliega para leerlo, como haría un jugador.
  const botonConsola = page.getByTestId("boton-plegar-consola");
  if ((await botonConsola.getAttribute("aria-expanded")) !== "true") await botonConsola.click();
  const robot = page.getByTestId("robot-0");
  await expect(robot).toBeVisible();
  await expect(robot).toHaveText(/^(Tu minirobot|Minirobot de .+): salto [0-4]\/4$/);
  if (process.env.RUTA_CAPTURA) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: process.env.RUTA_CAPTURA });
  }
});

// mrb-1: con el rival al lado del robot, este detona al empezar el turno de su
// dueño (en el cierre del turno de la IA) y su explosión se ve en su sitio,
// el robot desaparece y, si toca terreno, el cráter baja pixelesVivos.
test("minirobot-explosion: el robot detona a la vista, deja su explosión en su sitio y desaparece", async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();

  await abrirSelector(page);
  await page.getByTestId("arma-minirobot-saltaplanetas").click();

  const colocada = await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    for (const planeta of window.__debug.planetas ?? []) {
      const x = planeta.cx;
      const y = planeta.cy - planeta.radio - 70;
      if (x < 120 || x > mundo.ancho - 120 || y < 80) continue;
      if (window.__debug.terreno!.esSolido(Math.round(x), Math.round(y)) || window.__debug.terreno!.esSolido(Math.round(x + 40), Math.round(y))) continue;
      window.__debug.forzarPosicionNave!(0, x, y);
      window.__debug.forzarPosicionNave!(1, x + 40, y);
      return true;
    }
    return false;
  });
  expect(colocada, "hace falta un planeta con hueco encima para las dos naves").toBe(true);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
  await plegarConsola(page);
  await arrastrarDesdeNave(page, 0, 270, 40);
  await page.getByTestId("disparar").click();
  // El robot existe solo mientras la IA piensa: si esa búsqueda ocupa el hilo
  // principal, el robot puede posarse y detonar sin que el sondeo vea nunca
  // «un robot». Basta con que haya aparecido o con que ya haya detonado.
  await page.waitForFunction(
    () =>
      (window.__debug.robots?.length ?? 0) === 1 ||
      (window.__debug.detonaciones ?? []).some((d) => d.armaId === "minirobot-saltaplanetas"),
    undefined,
    { timeout: 120000 },
  );

  // El robot detona en el cierre del turno de la IA.
  await page.waitForFunction(
    () => (window.__debug.detonaciones ?? []).some((d) => d.armaId === "minirobot-saltaplanetas") && (window.__debug.robots?.length ?? 0) === 0,
    undefined,
    { timeout: 120000 },
  );
  const resultado = await page.evaluate(() => {
    const detonacion = window.__debug.detonaciones!.find((d) => d.armaId === "minirobot-saltaplanetas")!;
    const explosiones = (window.__debug.efectosVisibles ?? []).filter((e) => e.tipo === "explosion");
    return { detonacion, explosiones, robots: window.__debug.robots };
  });
  expect(resultado.robots).toHaveLength(0);
  const cerca = resultado.explosiones.some((e) => Math.hypot(e.x - resultado.detonacion.x, e.y - resultado.detonacion.y) <= 1);
  expect(cerca, "una explosión a ≤ 1 u de la detonación del robot").toBe(true);
  if (process.env.RUTA_CAPTURA) await page.screenshot({ path: process.env.RUTA_CAPTURA });
});
