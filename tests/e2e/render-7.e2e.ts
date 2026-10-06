import { test, type Page } from "@playwright/test";
import { arrastrarDesdeNave } from "./utilesApuntado";

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

  // DESVIACIÓN (apuntado-y-relevo): el apuntado es directo -- el gesto mide
  // ángulo y potencia desde la nave, no desde donde empieza el dedo. El
  // antiguo arrastre en diagonal fijaba 81°/95 % en escritorio y un vuelo que
  // no terminaba dentro del techo de espera; 45°/50 % es el apuntado por
  // defecto y cierra siempre. La potencia llega a 100 al 40 % del lado menor.
  // pantalla-completa: con el mundo 1,5x mayor el vuelo al 50 % en escritorio
  // seguía sin cerrar en 60 s en el CI; al 20 % cae pronto sobre el pozo
  // cercano y la captura de explosión sigue siendo la misma secuencia.
  const viewport = page.viewportSize()!;
  await arrastrarDesdeNave(page, 0, 45, 0.2 * 0.4 * Math.min(viewport.width, viewport.height));
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  await page.waitForFunction(() => window.__debug.animacionEnCurso === true);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `test-results/render-7/${prefijo}-02-vuelo.png` });

  // DESVIACIÓN (encuadre-movil): 15000ms se quedaba corto -- el mundo ya no
  // es siempre 1920x1080 (encuadre-movil-1 lo ajusta al aspecto real del
  // contenedor, incluida la orientación de escritorio) y un vuelo puede
  // recorrer más distancia de mundo que antes, alargando la animación.
  // Mismo techo que usan control-1/gra-2 para el mismo tipo de espera.
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 60000 });
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
    test.setTimeout(150000);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByTestId("boton-jugar").click();
    await capturarSecuenciaDePartida(page, viewport.nombre);
  });
}
