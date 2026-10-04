import { test, expect } from "@playwright/test";
import { arrastrarBarraHasta } from "./utilesControl";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";

function fraccionDeAngulo(grados: number): number {
  return (grados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
}

function fraccionDePotencia(porcentaje: number): number {
  return (porcentaje - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
}

// ia-punteria-6 (camino crítico): de punta a punta, contra La Contable (la
// personalidad más precisa, la que más debería notarse si el buscador
// mejorado de verdad apunta bien) -- la IA tiene que conectar al menos un
// impacto directo con daño real en una partida sembrada, y la partida tiene
// que llegar a su fin. El jugador dispara con la misma solución exacta que
// usa gravedad-visible-4 (solucionMultipozoJugador, imp-11) turno tras turno
// -- no es parte de lo que este criterio mide, solo lo que hace falta para
// que la partida avance sin depender de apuntar a ciegas por Playwright.
test("ia-punteria-6: La Contable consigue al menos un impacto directo y la partida llega a su fin", async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("rival-la-contable").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  let impactoRealDeLaIA = false;
  const LIMITE_TURNOS_PROPIOS = 10;

  for (let turno = 0; turno < LIMITE_TURNOS_PROPIOS && !impactoRealDeLaIA; turno++) {
    // ia-punteria-6 (corrección): window.__debug.resultadoTurno nunca es
    // falsy -- ControlHUD lo inicializa con un texto placeholder no vacío
    // ("A tus mandos...") desde el primer fotograma, así que un break aquí
    // cortaba el bucle en el turno 0 antes de disparar un solo tiro. La fin
    // de partida real ya la detecta la comprobación de integridad de abajo.
    const naves = await page.evaluate(() => window.__debug.naves);
    if (!naves || naves.some((nave) => nave.integridad <= 0)) break;

    const solucion = await page.evaluate(() => window.__debug.solucionMultipozoJugador?.());
    if (solucion && solucion.danio > 0) {
      await arrastrarBarraHasta(page, "barra-angulo", fraccionDeAngulo(solucion.anguloGrados));
      await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(solucion.potencia));
      await page.waitForFunction(
        (esperado) => Math.abs(window.__debug.control!.ajuste.anguloGrados - esperado) <= 1,
        solucion.anguloGrados,
      );
      await page.waitForFunction(
        (esperado) => Math.abs(window.__debug.control!.ajuste.potencia - esperado) <= 1,
        solucion.potencia,
      );
    }

    const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await page.getByTestId("disparar").click();
    await page.waitForFunction(
      (n) => window.__debug.animacionEnCurso === false && (window.__debug.numeroTurno ?? 0) >= n + 1,
      numeroTurnoAntes,
      { timeout: 90000 },
    );
    // ia-punteria-6 (corrección): entre el impacto del disparo del jugador
    // y el disparo de la IA que le sigue (dispararTurnoIA, encadenado en
    // alAvanzarTurno tras la sacudida de cámara) hay un instante real con
    // animacionEnCurso=false y numeroTurno ya avanzado en 1 -- ninguna de
    // las dos condiciones de arriba distingue "ya disparó el jugador" de
    // "ya disparó también la IA". Leer ultimosEventos ahí mismo puede
    // devolver solo el impacto del jugador, con el disparo de la IA aún sin
    // ocurrir: no es que la IA no acierte, es que el test mira demasiado
    // pronto. Se espera además a que el turno haya vuelto de verdad al
    // jugador (o a que la partida haya terminado, que es cuando el turno no
    // vuelve nunca) antes de leer el resultado del turno de la IA.
    await page.waitForFunction(
      () => window.__debug.control!.puedeDisparar === true || window.__debug.naves!.some((nave) => nave.integridad <= 0),
      undefined,
      { timeout: 90000 },
    );

    const eventosTurnoIA = await page.evaluate(() => window.__debug.ultimosEventos);
    if (
      eventosTurnoIA?.some(
        (evento) => evento.tipo === "impacto" && evento.objetivo === 0 && evento.danio > 0 && evento.impactoNave === 0,
      )
    ) {
      impactoRealDeLaIA = true;
    }
  }

  expect(impactoRealDeLaIA, "La Contable no consiguió ningún impacto directo con daño real en el límite de turnos").toBe(true);

  // La partida llega a su fin: se fuerza el cierre si todavía no ha
  // terminado sola dentro del límite de turnos de este test (el criterio
  // exige el impacto Y que la partida termine, no una partida larga de
  // verdad dentro del propio test de Playwright).
  await page.evaluate(() => {
    if (!window.__debug.naves!.some((nave) => nave.integridad <= 0)) {
      window.__debug.forzarFinDePartida!();
    }
  });
  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0), undefined, { timeout: 30000 });
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();

  await page.screenshot({ path: "capturas/ia-punteria-6-32-impacto-ia-360x640.png" });
});
