import { test, expect } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

// cie-2: el smoke test que la etapa de traspaso ejecuta contra la URL real
// ya desplegada (manifiesto: BASE_URL="$DEPLOY_URL" npx playwright test
// tests/smoke/traspaso.spec.ts) -- deliberadamente fuera de tests/e2e/ y de
// testMatch (*.e2e.ts) para que "npm run test:e2e" no lo recoja dos veces y
// para que se pueda invocar solo, con su propio BASE_URL, sin depender del
// webServer local de playwright.config.ts.
//
// Verificado en este bloque contra el servidor de producción local (npm run
// start, BASE_URL por defecto) -- ver desviaciones del entregable: la etapa
// de traspaso que crea el proyecto de Vercel y produce una URL de DEV real
// corre DESPUÉS de que Gatekeeper apruebe este mismo bloque, así que
// "ejecutado contra la URL de DEV" no es verificable todavía desde
// desarrollo. El smoke test queda listo para que esa etapa lo reejecute con
// BASE_URL=<url-de-dev-real> sin ningún cambio.
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";

test("la aplicación desplegada carga, muestra el sistema, y un disparo dirigido impacta y hace daño real", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 640 });

  const peticionesAjenas: string[] = [];
  const origenPropio = new URL(BASE_URL).origin;
  page.on("request", (peticion) => {
    const url = new URL(peticion.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origenPropio) peticionesAjenas.push(peticion.url());
  });

  await page.goto(BASE_URL);
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();

  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.planetas !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // Sistema con al menos tres planetas y dos naves colocadas fuera de los
  // sólidos (colocarNaves ya lo garantiza; aquí se comprueba, no se asume).
  const planetas = (await page.evaluate(() => window.__debug.planetas))!;
  expect(planetas.length).toBeGreaterThanOrEqual(3);

  const naves = (await page.evaluate(() => window.__debug.naves))!;
  expect(naves.length).toBe(2);
  for (const nave of naves) {
    const fueraDeSolido = await page.evaluate(
      ({ x, y }) => !window.__debug.terreno!.esSolido(x, y),
      { x: Math.round(nave.x), y: Math.round(nave.y) },
    );
    expect(fueraDeSolido).toBe(true);
  }

  // Disparo dirigido: el mismo oráculo real (barridoRejilla) que ya usa la
  // IA, con daño > 0 verificado contra el resolutor real antes de disparar
  // -- no una suposición de geometría ni una condición de parada propia del
  // test (imp-11).
  const solucion = await page.evaluate(() => window.__debug.solucionMultipozoJugador!());
  expect(solucion).not.toBeNull();
  expect(solucion!.danio).toBeGreaterThan(0);

  const integridadRivalAntes = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!
    .integridad;
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;

  const ajusteAntes = (await page.evaluate(() => window.__debug.control!.ajuste))!;
  const deltaY = -(solucion!.anguloGrados - ajusteAntes.anguloGrados) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (solucion!.potencia - ajusteAntes.potencia) / GANANCIA_POTENCIA;
  const inicio = { x: 160, y: 560 };
  const fin = { x: inicio.x + deltaX * 360, y: inicio.y + deltaY * 640 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    (n) => (window.__debug.numeroTurno ?? 0) >= n + 1 && window.__debug.animacionEnCurso === false,
    numeroTurnoAntes,
    { timeout: 90000 },
  );

  // Un disparo completo termina con un resultado declarado y el turno
  // avanza.
  const resultadoTurno = await page.evaluate(() => window.__debug.resultadoTurno);
  expect(resultadoTurno).toBeTruthy();
  expect((await page.evaluate(() => window.__debug.numeroTurno)) ?? 0).toBeGreaterThan(numeroTurnoAntes);

  // El disparo dirigido a la nave rival con la entrada determinista de
  // depuración reduce su integridad mostrada.
  const integridadRivalDespues = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!
    .integridad;
  expect(integridadRivalDespues).toBeLessThan(integridadRivalAntes);

  // Ninguna petición de red distinta de la carga de la propia aplicación.
  expect(peticionesAjenas).toEqual([]);
});
