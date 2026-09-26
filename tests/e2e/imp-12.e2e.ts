import { test, expect } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

// imp-12 (no camino_critico -- se anota si falla, no bloquea el bloque):
// usabilidad de la resolución de un disparo -- un impacto con daño y uno sin
// daño deben distinguirse a simple vista (fogonazo distinto,
// window.__debug.ultimoTipoExplosion lo confirma sin leer píxeles), el
// panel de resultado debe mostrar un número legible en el impacto directo, y
// el caso de daño cero debe traer un texto que lo explique, nunca un "0" a
// secas ni el panel vacío. La calidad visual de la captura la juzga el
// Gatekeeper sobre la rúbrica (eje 6); aquí se comprueba la parte mecánica.
//
// Igual que imp-11: cada comprobación se hace justo cuando numeroTurno
// avanza en +1 tras "disparar", antes de que la respuesta de la máquina
// resuelva su propio turno y sobrescriba ultimoTipoExplosion/resultado-turno
// con su propio desenlace.
test("imp-12: el impacto y el fallo se distinguen visualmente, y el panel de resultado siempre explica lo que pasó", async ({
  page,
}) => {
  // Ver imp-11: cuatro vuelos animados de punta a punta (dos disparos del
  // jugador y las dos respuestas de la máquina) bajo WebGL por software.
  test.setTimeout(150000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  async function arrastrarHasta(anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
    const ajusteAntes = (await page.evaluate(() => window.__debug.control!.ajuste))!;
    const deltaY = -(anguloObjetivo - ajusteAntes.anguloGrados) / GANANCIA_ANGULO_GRADOS;
    const deltaX = (potenciaObjetivo - ajusteAntes.potencia) / GANANCIA_POTENCIA;

    const inicio = { x: 160, y: 560 };
    const fin = { x: inicio.x + deltaX * 360, y: inicio.y + deltaY * 640 };
    await page.mouse.move(inicio.x, inicio.y);
    await page.mouse.down();
    await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
    await page.mouse.move(fin.x, fin.y, { steps: 5 });
    await page.mouse.up();
  }

  async function dispararYEsperarEsteDisparo(anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
    const numeroAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await arrastrarHasta(anguloObjetivo, potenciaObjetivo);
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await page.getByTestId("disparar").click();
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, numeroAntes, { timeout: 60000 });
  }

  // Impacto directo: la solución balística exacta (deriva 0) del turno del
  // jugador ahora mismo.
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();

  await dispararYEsperarEsteDisparo(solucion!.anguloGrados, solucion!.potencia);

  expect(await page.evaluate(() => window.__debug.ultimoTipoExplosion)).toBe("danio");
  const textoImpacto = (await page.getByTestId("resultado-turno").textContent())!.trim();
  expect(textoImpacto).toMatch(/impacto directo: \d+ de daño/i);

  await page.screenshot({ path: "capturas/impacto-naves-8-imp12-impacto-directo.png" });

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });

  // Fallo fuera de radio: vertical y de poca potencia, cae junto al propio
  // tirador -- ver imp-11 para el mismo razonamiento geométrico.
  await dispararYEsperarEsteDisparo(90, 15);

  expect(await page.evaluate(() => window.__debug.ultimoTipoExplosion)).toBe("sin-danio");
  const textoFallo = (await page.getByTestId("resultado-turno").textContent())!.trim();
  expect(textoFallo.length).toBeGreaterThan(0);
  expect(textoFallo).not.toBe("0");

  await page.screenshot({ path: "capturas/impacto-naves-8-imp12-fuera-de-radio.png" });
});
