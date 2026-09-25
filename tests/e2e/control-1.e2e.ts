import { test, expect } from "@playwright/test";

// Deben coincidir con src/juego/control/apuntado.ts (GANANCIA_ANGULO_GRADOS,
// GANANCIA_POTENCIA, ANGULO_INICIAL_GRADOS, POTENCIA_INICIAL): el e2e no
// importa del código fuente (convención ya establecida en render-4/andamiaje,
// que tampoco lo hacen), así que estas constantes viven duplicadas a
// propósito. Si alguna vez divergen, este test falla de forma ruidosa, no en
// silencio.
const GANANCIA_ANGULO_GRADOS = 120;
const GANANCIA_POTENCIA = 150;
const ANGULO_INICIAL_GRADOS = 45;
const POTENCIA_INICIAL = 50;

// control-1: de punta a punta en móvil -- elige arma, ajusta ángulo/potencia
// con un gesto de arrastre real, dispara; el terreno pierde píxeles, la nave
// objetivo pierde integridad, el turno pasa a la máquina y la máquina
// dispara a su vez. Se navega con ?mapa=calma-de-los-restos (deriva 0) para
// que la solución balística expuesta por window.__debug sea exacta -- el
// gesto en sí sigue siendo un arrastre real de Playwright, no un salto
// directo al ángulo objetivo.
test("elegir arma, apuntar por gesto y disparar hace perder píxeles de terreno e integridad, y la máquina responde", async ({
  page,
}) => {
  // Dos turnos animados de punta a punta (vuelo + explosión del jugador,
  // vuelo + explosión de la máquina) bajo WebGL por software (ver hueco de
  // render-3: SwiftShader no alcanza ni 5fps en reposo en este host) pueden
  // superar los timeouts por defecto sin que haya nada roto.
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);

  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // Elegir arma: abrir selector y escoger la Tostadora Orbital.
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("arma-tostadora-orbital").click();

  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();

  const objetivoAntes = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!;
  // Unos píxeles POR DEBAJO de la superficie (no encima, donde ya es aire
  // antes de disparar): el cráter de la Tostadora Orbital (radio 26px) debe
  // comerse este punto si el impacto aterriza donde pide la solución.
  const puntoBajoNave = { x: Math.round(objetivoAntes.x), y: Math.round(objetivoAntes.y) + 8 };
  const impactoTerrenoAntes = await page.evaluate(
    ({ x, y }) => window.__debug.terreno!.esSolido(x, y),
    puntoBajoNave,
  );

  const deltaY = -(solucion!.anguloGrados - ANGULO_INICIAL_GRADOS) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (solucion!.potencia - POTENCIA_INICIAL) / GANANCIA_POTENCIA;

  const inicio = { x: 195, y: 760 };
  const fin = { x: inicio.x + deltaX * 390, y: inicio.y + deltaY * 844 };

  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  const ajuste = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(Math.abs(ajuste.anguloGrados - solucion!.anguloGrados)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(ajuste.potencia - solucion!.potencia)).toBeLessThanOrEqual(1);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  // Espera determinista (issue #151): el turno vuelve al jugador (0) y van
  // dos turnos resueltos (el del jugador y la respuesta de la máquina), sin
  // animación en curso.
  await page.waitForFunction(
    () => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2 && window.__debug.animacionEnCurso === false,
    undefined,
    { timeout: 60000 },
  );

  const objetivoDespues = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!;
  expect(objetivoDespues.integridad).toBeLessThan(objetivoAntes.integridad);

  const impactoTerrenoDespues = await page.evaluate(
    ({ x, y }) => window.__debug.terreno!.esSolido(x, y),
    puntoBajoNave,
  );
  expect(impactoTerrenoAntes).toBe(true);
  expect(impactoTerrenoDespues).toBe(false);
});
