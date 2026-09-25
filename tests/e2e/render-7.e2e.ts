import { test, type Page } from "@playwright/test";

// render-7: calidad visual subjetiva, la valora el Gatekeeper con estas
// capturas -- este test no tiene aserciones propias, solo genera las 4
// capturas x 2 viewports de forma determinista y con nombre estable, para
// que la revisión no dependa de que alguien las tome a mano.
const VIEWPORTS = [
  { nombre: "movil", width: 360, height: 740 },
  { nombre: "escritorio", width: 1280, height: 800 },
];

async function capturarSecuenciaDePartida(page: Page, prefijo: string) {
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
  await page.screenshot({ path: `test-results/render-7/${prefijo}-01-inicio.png` });

  // DESVIACIÓN (control-apuntado): el tirachinas (arrastrar y disparar en
  // el mismo gesto) ya no existe -- se sustituye por apuntado indirecto con
  // ganancia y un botón explícito de disparo.
  const viewport = page.viewportSize()!;
  const inicio = { x: viewport.width * 0.3, y: viewport.height * 0.85 };
  const fin = { x: viewport.width * 0.6, y: viewport.height * 0.55 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fin.x, fin.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  await page.waitForFunction(() => window.__debug.animacionEnCurso === true);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `test-results/render-7/${prefijo}-02-vuelo.png` });

  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 15000 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `test-results/render-7/${prefijo}-03-post-explosion.png` });

  // jugarTurnosGuionizados(N) no garantiza un fin de partida: el
  // enfrentamiento La Contable / Almirante Bisagra en el mapa por defecto no
  // converge a un ganador ni en 200 turnos (comprobado aparte con una
  // simulación de partida completa) -- forzarFinDePartida() dispara con
  // puntería balística exacta y el autodaño garantizado de Despedida, lo que
  // sí acota el número de turnos hasta que alguien llega a 0.
  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0));
  await page.screenshot({ path: `test-results/render-7/${prefijo}-04-fin-de-partida.png` });
}

for (const viewport of VIEWPORTS) {
  test(`capturas de calidad visual en ${viewport.nombre} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    // Secuencia completa animada en tiempo real (vuelo + explosión + hasta
    // 12 turnos de desenlace forzado): el timeout por defecto de Playwright
    // (30000ms) se queda corto, no es un test lento por accidente.
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByTestId("boton-jugar").click();
    await capturarSecuenciaDePartida(page, viewport.nombre);
  });
}
