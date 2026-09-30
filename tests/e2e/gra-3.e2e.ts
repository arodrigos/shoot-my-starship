import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// gra-3 (camino crítico): mismo patrón que control-1 (solución balística
// exacta, mapa calma-de-los-restos) -- la integridad de la nave rival no
// baja ANTES de que se resuelva la detonación (ni justo tras el disparo, ni
// a mitad de la cuenta atrás), solo DESPUÉS, y el turno avanza con ella.
test("gra-3: la integridad rival solo baja al detonar la granada, nunca antes, y el turno avanza con ella", async ({
  page,
}) => {
  // Mismo motivo que control-1 (WebGL por software, hueco de render-3):
  // un turno completo (vuelo + detonación + respuesta parcial de la
  // máquina hasta que avanza el número de turno) puede superar los 60s por
  // defecto sin que haya nada roto.
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("arma-granada-de-espoleta").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "granada-de-espoleta");

  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();

  const fraccionAngulo = (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
  const fraccionPotencia = (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
  await arrastrarBarraHasta(page, "barra-angulo", fraccionAngulo);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionPotencia);

  const integridadAntesDisparar = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!.integridad;
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  await page.waitForFunction(
    (n) => window.__debug.animacionEnCurso === true && (window.__debug.numeroTurno ?? 0) === n,
    numeroTurnoAntes,
  );
  // imp/proy-5 (fallo intermitente diagnosticado en desarrollo-18): un solo
  // evaluate() para que integridad y "sigue en el mismo vuelo" sean del
  // mismo instante exacto.
  const durantelaCuenta = await page.evaluate((n) => {
    const enCurso = window.__debug.animacionEnCurso === true && (window.__debug.numeroTurno ?? 0) === n;
    return { enCurso, integridad: window.__debug.naves!.find((nave) => nave.id === 1)!.integridad };
  }, numeroTurnoAntes);
  expect(durantelaCuenta.enCurso).toBe(true);

  // No hace falta esperar a que termine la animación de RESPUESTA de la
  // máquina (puede tardar varios segundos reales bajo WebGL por software,
  // ver hueco de render-3) -- aplicarResultadoTurno (y la integridad que
  // deja) ya corrió de forma síncrona en cuanto se resolvió el impacto de
  // la granada, antes de que el turno avance.
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, numeroTurnoAntes);

  const integridadDespuesDeDetonar = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!.integridad;

  expect(durantelaCuenta.integridad).toBe(integridadAntesDisparar);
  expect(integridadDespuesDeDetonar).toBeLessThan(durantelaCuenta.integridad);

  const numeroTurnoDespues = await page.evaluate(() => window.__debug.numeroTurno);
  expect(numeroTurnoDespues).toBeGreaterThanOrEqual(numeroTurnoAntes + 1);
});
