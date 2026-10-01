import { test, expect } from "@playwright/test";
import { arrastrarBarraHasta } from "./utilesControl";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS } from "@/juego/control/apuntado";

// pvr-3 (camino crítico): "apuntar se siente controlable" -- la mira sigue
// al control sin retardo perceptible. En vez de medir un número de
// fotogramas (issue #151 prohíbe asertos atados a una ventana de tiempo:
// serían flaky bajo contención de CI), se comprueba una propiedad
// determinista más fuerte: la mira es una función PURA del ajuste vivo, sin
// caché ni valor pegado de un fotograma anterior. Tres ajustes distintos
// (A, B, A de nuevo) deben producir exactamente la mira A, B, A -- si
// hubiera cualquier retardo o memoria de un valor viejo, la tercera lectura
// no coincidiría con la primera byte a byte.
//
// El coste de CPU de recalcular la mira cada fotograma mientras se arrastra
// es el otro half del criterio y se mide aparte, en
// tests/unit/rendimiento/esp-8.test.ts (pvr-3): aquí solo se verifica
// correspondencia de valores, no presupuesto de cómputo.
test("pvr-3: la previsualización corresponde siempre al ajuste vivo de ángulo y potencia, sin valor pegado de un ajuste anterior", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const fraccionDeAngulo = (grados: number): number =>
    (grados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);

  await arrastrarBarraHasta(page, "barra-angulo", fraccionDeAngulo(30));
  await arrastrarBarraHasta(page, "barra-potencia", 0.5);
  await page.waitForFunction(() => Math.abs(window.__debug.control!.ajuste.anguloGrados - 30) <= 0.5);
  const previsualizacionA = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionA?.puntos.length ?? 0).toBeGreaterThanOrEqual(2);

  await arrastrarBarraHasta(page, "barra-angulo", fraccionDeAngulo(150));
  await page.waitForFunction(() => Math.abs(window.__debug.control!.ajuste.anguloGrados - 150) <= 0.5);
  const previsualizacionB = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionB).not.toEqual(previsualizacionA);

  await arrastrarBarraHasta(page, "barra-angulo", fraccionDeAngulo(30));
  await page.waitForFunction(() => Math.abs(window.__debug.control!.ajuste.anguloGrados - 30) <= 0.5);
  const previsualizacionC = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionC).toEqual(previsualizacionA);

  // El paso fino de teclado/botón (control-angulo-potencia: 0,1° por clic)
  // es el gesto más pequeño posible -- si algo quedara pegado a un valor
  // anterior, sería aquí donde se notaría primero.
  const ajusteAntesDelPaso = await page.evaluate(() => window.__debug.control!.ajuste);
  await page.getByTestId("paso-angulo-mas").click();
  await page.waitForFunction(
    (esperado) => Math.abs(window.__debug.control!.ajuste.anguloGrados - esperado) < 0.01,
    ajusteAntesDelPaso.anguloGrados + 0.1,
  );
  const previsualizacionTrasPasoFino = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionTrasPasoFino).not.toEqual(previsualizacionC);

  // Y el paso fino de potencia (1 por clic) cambia la mira igual de rápido:
  // la velocidad inicial del tiro depende de la potencia, así que un ajuste
  // distinto tiene que dibujar una curva distinta.
  const ajusteAntesDePotencia = await page.evaluate(() => window.__debug.control!.ajuste);
  await page.getByTestId("paso-potencia-mas").click();
  await page.waitForFunction(
    (esperado) => Math.abs(window.__debug.control!.ajuste.potencia - esperado) < 0.01,
    ajusteAntesDePotencia.potencia + 1,
  );
  const previsualizacionTrasPasoPotencia = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionTrasPasoPotencia).not.toEqual(previsualizacionTrasPasoFino);
});
