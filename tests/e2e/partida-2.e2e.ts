import { test, expect } from "@playwright/test";

// partida-2 (camino_critico): nada sale del propio origen durante una
// partida completa -- ni Supabase, ni telemetría, ni una API de LLM (el
// diseño es explícito: el juego no depende de red en el móvil de Adrián).
// Se engancha page.on("request") ANTES de goto (issue #151: escuchar desde
// el primer byte, no desde después de cargar, que dejaría pasar peticiones
// tempranas sin comprobar) y se recorre el mismo camino que partida-1 --
// inicio, elegir rival, disparo real, fin de partida forzado (misma
// desviación que partida-1) y otra partida -- para que la comprobación
// cubra el juego completo, no solo la pantalla de inicio.
test("una partida completa no hace ninguna petición fuera del propio origen", async ({ page }) => {
  test.setTimeout(90000);
  const ajenas: string[] = [];

  const ORIGEN_PROPIO = "http://127.0.0.1:3000";
  page.on("request", (peticion) => {
    const url = new URL(peticion.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== ORIGEN_PROPIO) {
      ajenas.push(peticion.url());
    }
  });

  await page.goto("/");
  await page.getByTestId("rival-chispa").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.mapa !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const inicio = { x: 180, y: 620 };
  const fin = { x: 140, y: 520 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    () => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2 && window.__debug.animacionEnCurso === false,
    undefined,
    { timeout: 60000 },
  );

  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0), undefined, {
    timeout: 60000,
  });
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();

  await page.getByTestId("otra-partida").click();
  await page.waitForFunction(() => window.__debug.numeroTurno === 0);

  expect(ajenas).toEqual([]);
});
