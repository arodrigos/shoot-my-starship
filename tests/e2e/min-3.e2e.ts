import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// min-3 (camino crítico): mismo patrón que gra-3, pero con TRES instantes en
// vez de dos -- a diferencia de la granada (cuenta desde el disparo, solo
// hay "durante el vuelo" y "después"), la mina tiene una fase extra: antes
// de pegarse (en vuelo, cuentaAtrasAdherencia aún null), durante la cuenta
// (ya pegada, cuentaAtrasAdherencia no null) y después de detonar. La
// integridad rival debe seguir intacta en las DOS primeras fases y solo caer
// en la tercera.
test("min-3: la integridad rival solo baja al detonar la mina, no al pegarse ni durante el vuelo previo", async ({
  page,
}) => {
  // Mismo motivo que gra-3 (WebGL por software, hueco de render-3).
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
  await page.getByTestId("arma-gancho-pegajoso").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "gancho-pegajoso");

  // Mismo hook que min-2/gra-2: fuerza una mecha corta y determinista tras
  // la adherencia, muy por debajo del vuelo natural de este ángulo/potencia.
  await page.evaluate(() => window.__debug.forzarFusibleAdherenciaPasos!(100));

  // Mismo patrón que gra-3/control-1: la solución balística exacta del
  // propio motor, no un ángulo/potencia adivinado -- así el disparo SÍ corta
  // el casco rival y hay detonación real que comprobar, en vez de fallar y
  // dejar la integridad intacta por un motivo ajeno al criterio.
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

  // imp/proy-5 (mismo hueco que gra-3, diagnosticado en desarrollo-18): un
  // solo evaluate() por muestra para que "en curso", "pegada" e "integridad"
  // sean del mismo instante exacto.
  let integridadEnVueloPrevio: number | null = null;
  let integridadDuranteCuenta: number | null = null;
  for (let i = 0; i < 400; i++) {
    const instante = await page.evaluate((n) => {
      const enCurso = window.__debug.animacionEnCurso === true && (window.__debug.numeroTurno ?? 0) === n;
      if (!enCurso) return { enCurso: false as const, pegada: false, integridad: 0 };
      return {
        enCurso: true as const,
        pegada: window.__debug.cuentaAtrasAdherencia != null,
        integridad: window.__debug.naves!.find((nave) => nave.id === 1)!.integridad,
      };
    }, numeroTurnoAntes);
    if (!instante.enCurso) break;
    if (!instante.pegada && integridadEnVueloPrevio === null) {
      integridadEnVueloPrevio = instante.integridad;
    }
    if (instante.pegada) {
      integridadDuranteCuenta = instante.integridad;
      // Ya se tiene una muestra de cada una de las dos primeras fases --
      // no hace falta seguir sondeando toda la cuenta atrás.
      if (integridadEnVueloPrevio !== null) break;
    }
    await page.waitForTimeout(5);
  }
  expect(integridadEnVueloPrevio, "no se llegó a observar la mina en vuelo antes de pegarse").not.toBeNull();
  expect(integridadDuranteCuenta, "no se llegó a observar la mina ya pegada, contando").not.toBeNull();

  // No hace falta esperar a la animación de RESPUESTA de la máquina (puede
  // tardar segundos bajo WebGL por software, ver hueco de render-3) --
  // aplicarResultadoTurno ya corrió de forma síncrona en cuanto se resolvió
  // la detonación, antes de que el turno avance.
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, numeroTurnoAntes);

  const integridadDespuesDeDetonar = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!.integridad;

  expect(integridadEnVueloPrevio).toBe(integridadAntesDisparar);
  expect(integridadDuranteCuenta).toBe(integridadAntesDisparar);
  expect(integridadDespuesDeDetonar).toBeLessThan(integridadDuranteCuenta!);

  const numeroTurnoDespues = await page.evaluate(() => window.__debug.numeroTurno);
  expect(numeroTurnoDespues).toBeGreaterThanOrEqual(numeroTurnoAntes + 1);
});
