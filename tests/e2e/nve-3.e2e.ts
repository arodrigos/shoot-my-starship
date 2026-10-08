import { test, expect } from "@playwright/test";
import { puntoLibreDeArrastre } from "./utilesApuntado";

// Duplicadas a propósito (convención de control-1/control-5): deben coincidir
// con src/juego/control/apuntado.ts y src/juego/naves/formaCasco.ts. Si
// alguna vez divergen, este test falla de forma ruidosa, no en silencio.
const GANANCIA_ANGULO_GRADOS = 120;
const GANANCIA_POTENCIA = 150;
const ANGULO_INICIAL_GRADOS = 45;
const POTENCIA_INICIAL = 50;

function nivelDanioEsperado(integridad: number): "alta" | "media" | "baja" {
  if (integridad > 66) return "alta";
  if (integridad > 33) return "media";
  return "baja";
}

// nve-3: de punta a punta -- apuntar por gesto real, disparar, impactar a la
// rival -- con las siluetas nuevas, y comprobar que el tramo de daño DIBUJADO
// (window.__debug.naves[].nivelDanio) es el que le corresponde a la
// integridad real que acaba de declarar el núcleo tras el impacto, no una
// animación por su cuenta. ?mapa=calma-de-los-restos (deriva 0) para que la
// solución balística expuesta sea exacta, igual que control-1.
test("nve-3: tras un impacto real, el tramo de daño dibujado corresponde a la integridad real y el turno avanza", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // Misma arma que control-1: su solución balística contra calma-de-los-restos
  // cae dentro del recorrido de arrastre que cabe en el viewport de 390x844.
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("arma-mortero-lamentable").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "mortero-lamentable");

  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;

  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();

  const deltaY = -(solucion!.anguloGrados - ANGULO_INICIAL_GRADOS) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (solucion!.potencia - POTENCIA_INICIAL) / GANANCIA_POTENCIA;

  const inicio = await puntoLibreDeArrastre(page);
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

  // Espera determinista (issue #151): el turno del jugador queda resuelto y
  // no hay animación en curso -- no hace falta esperar a la respuesta de la
  // máquina para comprobar el criterio (ya impactó a la rival).
  await page.waitForFunction(
    (turnoAntes) => (window.__debug.numeroTurno ?? 0) > turnoAntes && window.__debug.animacionEnCurso === false,
    numeroTurnoAntes,
    { timeout: 150000 },
  );

  const rival = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!;
  expect(rival.integridad).toBeLessThan(100);
  expect(rival.nivelDanio).toBe(nivelDanioEsperado(rival.integridad));

  const numeroTurnoDespues = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  expect(numeroTurnoDespues).toBeGreaterThan(numeroTurnoAntes);
});
