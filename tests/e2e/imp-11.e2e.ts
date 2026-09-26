import { test, expect } from "@playwright/test";
import { buscarArma } from "@/sim/armas/catalogo";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

// imp-11 (camino_critico): las dos ramas del contrato de daño, de punta a
// punta y con entrada determinista -- un disparo bien apuntado (la solución
// balística exacta que expone window.__debug, igual que control-1) reduce
// la integridad del rival un valor consistente con el catálogo, y un
// disparo deliberadamente fuera del radio de daño del arma NO la reduce en
// absoluto. Viewport 360x640 (móvil de referencia). Se navega con
// ?mapa=calma-de-los-restos (deriva 0) para que la solución balística sea
// exacta, igual que control-1.
//
// La medición se toma justo cuando numeroTurno avanza en +1 tras el click de
// "disparar" -- NO tras esperar también la respuesta de la máquina (turno
// vuelto a 0): la IA puede elegir un arma con autodaño garantizado
// (Despedida) y dañarse a sí misma en su propio turno, lo que contaminaría
// la integridad del rival con daño que no viene del disparo del jugador. En
// ese punto intermedio la respuesta de la máquina ya está en vuelo
// (animacionEnCurso true) pero su turno aún no se ha resuelto, así que
// naves[] todavía refleja solo el efecto del disparo que se está midiendo.
test("imp-11: un disparo bien apuntado reduce la integridad del rival según el catálogo, y uno fuera de radio no la reduce", async ({
  page,
}) => {
  // Cuatro vuelos animados de punta a punta (dos disparos del jugador y las
  // dos respuestas de la máquina) bajo WebGL por software (ver hueco de
  // render-3): el doble de carga que control-1, que ya necesita más que el
  // timeout por defecto para dos.
  test.setTimeout(150000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const armaBase = buscarArma((await page.evaluate(() => window.__debug.control!.ajuste.armaId))!);
  const efecto = armaBase.efecto;
  if (efecto.tipo !== "danio") {
    throw new Error("imp-11 espera que el arma de ajuste inicial sea de tipo daño");
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

  // Dispara con el ángulo/potencia dados y espera SOLO a que este disparo
  // (no la respuesta de la máquina) quede resuelto.
  async function dispararYEsperarEsteDisparo(anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
    const numeroAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await arrastrarHasta(anguloObjetivo, potenciaObjetivo);
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await page.getByTestId("disparar").click();
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, numeroAntes, { timeout: 60000 });
  }

  // Rama 1: disparo bien apuntado -- la solución balística exacta (deriva 0)
  // para el turno del jugador ahora mismo.
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();

  const objetivoAntesImpacto = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!;
  await dispararYEsperarEsteDisparo(solucion!.anguloGrados, solucion!.potencia);
  const objetivoDespuesImpacto = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!;

  const danioCausado = objetivoAntesImpacto.integridad - objetivoDespuesImpacto.integridad;
  expect(danioCausado).toBeGreaterThan(0);
  expect(danioCausado).toBeLessThanOrEqual(efecto.danioMaximo);

  await page.screenshot({ path: "capturas/impacto-naves-8-imp11-impacto-directo.png" });

  // Deja que la respuesta de la máquina termine del todo antes de que el
  // jugador vuelva a apuntar (puedeDisparar solo será true de nuevo cuando
  // sea su turno).
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });

  // Rama 2: disparo deliberadamente vertical y de poca potencia -- sube casi
  // recto y cae junto al propio tirador, muy por encima del radio de daño
  // del arma respecto al rival, que sigue en su sitio al otro lado del
  // mundo.
  const objetivoAntesFallo = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!;
  await dispararYEsperarEsteDisparo(90, 15);
  const objetivoDespuesFallo = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!;

  expect(objetivoDespuesFallo.integridad).toBe(objetivoAntesFallo.integridad);

  await page.screenshot({ path: "capturas/impacto-naves-8-imp11-fuera-de-radio.png" });
});
