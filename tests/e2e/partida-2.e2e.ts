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
  // proyectiles-visibles (desviación, ver entregable): mismo margen que
  // partida-1 -- un vuelo real ahora tarda ~65s en esta VPS sin GPU.
  test.setTimeout(180000);
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
    { timeout: 120000 },
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

// modo-6 (camino_critico): el dinero vive solo en el store en memoria de esta
// pestaña -- recargar la página tiene que devolver el saldo al valor inicial
// del catálogo, no arrastrar el de la partida anterior, y el modo con
// presupuesto tampoco hace ninguna petición ajena (mismo guardia que el test
// de arriba, aquí para el modo con dinero, que es el que más tienta a
// "guardar el progreso" en algún sitio). SALDO_INICIAL duplicada a propósito
// (convención de modo-1.e2e.ts): si el catálogo cambia el número de arranque
// sin que este test se entere, el fallo tiene que ser ruidoso.
const SALDO_INICIAL = 1000;
// vertedero-portatil: danioMaximo 0 en el catálogo real -- la única arma de
// pago que garantiza ingreso 0 SIEMPRE, sea acierto o fallo, así que el saldo
// tras dispararla es aritméticamente exacto sin tener que apuntar a la nave
// rival ni depender de la dispersión del arma. Coste 15 tras el reprecio de
// armas-reprecio-roles (antes 20; ver armas-reprecio-roles-5 en catalogo.ts).
const ARMA_SIN_DANIO_ID = "vertedero-portatil";
const COSTE_ARMA_SIN_DANIO = 15;

test("modo-6: recargar la página resetea el saldo al valor inicial y ninguna petición sale del propio origen en modo presupuesto", async ({
  page,
}) => {
  test.setTimeout(120000);
  const ajenas: string[] = [];

  const ORIGEN_PROPIO = "http://127.0.0.1:3000";
  page.on("request", (peticion) => {
    const url = new URL(peticion.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== ORIGEN_PROPIO) ajenas.push(peticion.url());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos&modo=presupuesto");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.saldo !== undefined && window.__debug.saldo !== null);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const saldoInicial = (await page.evaluate(() => window.__debug.saldo))!;
  expect(saldoInicial).toBe(SALDO_INICIAL);

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId(`arma-${ARMA_SIN_DANIO_ID}`).click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => (window.__debug.numeroTurno ?? 0) >= 1 && window.__debug.animacionEnCurso === false, undefined, {
    timeout: 60000,
  });

  const saldoTrasDisparo = await page.evaluate(() => window.__debug.saldo);
  expect(saldoTrasDisparo).toBe(saldoInicial - COSTE_ARMA_SIN_DANIO);

  // "Recargar la página" de verdad: navegación completa, no un reinicio de
  // React -- así el saldo solo puede sobrevivir si alguien lo guardó fuera
  // del store en memoria (localStorage, red...), que es justo lo que este
  // criterio prohíbe.
  await page.reload();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.saldo !== undefined && window.__debug.saldo !== null);

  const saldoTrasRecarga = await page.evaluate(() => window.__debug.saldo);
  expect(saldoTrasRecarga).toBe(SALDO_INICIAL);

  expect(ajenas).toEqual([]);
});
