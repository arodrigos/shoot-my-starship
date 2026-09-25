import { test, expect } from "@playwright/test";

// Deben coincidir con src/juego/control/apuntado.ts (misma convención que
// control-1: el e2e no importa del código fuente, así que estas constantes
// viven duplicadas a propósito).
const GANANCIA_ANGULO_GRADOS = 120;
const GANANCIA_POTENCIA = 150;
const ANGULO_INICIAL_GRADOS = 45;
const POTENCIA_INICIAL = 50;

// humor-6: reproducirRepeticion() reproduce el último vuelo con una instancia
// de AnimadorProyectil completamente aparte, con exactamente el mismo
// (inicial, gravedad, deriva, detenerse) que el vuelo real -- el punto donde
// se detiene debe coincidir con el impacto ya visto, y hacerlo no debe haber
// tocado el estado de la partida (turno, naves) mientras tanto.
test("humor-6: repetir el último disparo reproduce el mismo punto de impacto sin tocar el estado de la partida", async ({
  page,
}) => {
  test.setTimeout(90000);
  // El ángulo/potencia por defecto (sin arrastre) puede producir una
  // trayectoria muy lofted que tarda decenas de segundos reales en resolver
  // (confirmado por medición directa) -- se apunta con la solución balística
  // real, como control-1, para un impacto directo y rápido en la nave
  // objetivo, y así acotar el tiempo del turno del jugador.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();
  const deltaY = -(solucion!.anguloGrados - ANGULO_INICIAL_GRADOS) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (solucion!.potencia - POTENCIA_INICIAL) / GANANCIA_POTENCIA;
  const inicio = { x: 195, y: 760 };
  const fin = { x: inicio.x + deltaX * 390, y: inicio.y + deltaY * 844 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  // Espera a que se resuelvan los dos turnos (jugador + respuesta de la IA,
  // que es la que queda como "último disparo" -- ver reaccionarAHumor: la
  // repetición no distingue de quién fue el disparo, solo el más reciente).
  // La IA no se apunta desde el test (su trayectoria no es controlable
  // aquí), así que el margen se deja generoso -- ver hueco de render-3.
  await page.waitForFunction(
    () => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2 && window.__debug.animacionEnCurso === false,
    undefined,
    { timeout: 60000 },
  );

  // Se compara contra impactoReal (donde de verdad se detuvo la animación
  // cliente), no impacto (el valor teórico del núcleo): pueden diferir en
  // el mismo disparo porque la máscara que ve el cliente ya lleva tallado el
  // cráter de este disparo antes de que la animación arranque -- la
  // repetición reproduce fielmente la animación ya vista, no el cálculo del
  // núcleo (ver desviaciones).
  const impactoOriginal = await page.evaluate(() => window.__debug.ultimoDisparo!.impactoReal!);
  const navesAntes = await page.evaluate(() => window.__debug.naves);
  const numeroTurnoAntes = await page.evaluate(() => window.__debug.numeroTurno);

  await page.evaluate(() => window.__debug.reproducirRepeticion!());
  await page.waitForFunction(() => window.__debug.repeticionEnCurso === true);
  await page.waitForFunction(() => window.__debug.repeticionEnCurso === false, undefined, { timeout: 20000 });

  const impactoRepetido = await page.evaluate(() => window.__debug.impactoRepeticion);
  expect(impactoRepetido).not.toBeNull();
  expect(impactoRepetido!.x).toBeCloseTo(impactoOriginal.x, 1);
  expect(impactoRepetido!.y).toBeCloseTo(impactoOriginal.y, 1);

  const navesDespues = await page.evaluate(() => window.__debug.naves);
  const numeroTurnoDespues = await page.evaluate(() => window.__debug.numeroTurno);
  expect(navesDespues).toEqual(navesAntes);
  expect(numeroTurnoDespues).toBe(numeroTurnoAntes);
});
