import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// encuadre-movil-4 (devuelto por el gatekeeper): la versión anterior jugaba
// UN disparo cualquiera y llamaba a forzarFinDePartida() para llegar a la
// pantalla de ganador -- eso prueba que el modal existe, no que una partida
// se gana. Aquí se juega de verdad, turno a turno, con el arma de serie
// (pepinazo-cortesia: 20 de daño, radio de 70px) apuntada con la solución
// balística exacta que expone window.__debug (mismo patrón que
// control-1.e2e.ts). Se navega con ?mapa=calma-de-los-restos (deriva 0)
// precisamente porque ahí la solución es exacta turno a turno: con 5
// impactos de 20 de daño basta para vaciar la integridad de cualquiera de
// las dos naves, así que el enfrentamiento converge en pocos turnos sin
// depender de que la IA "pierda" por accidente. forzarFinDePartida() se
// conserva solo como red de seguridad del timeout (nunca como camino
// normal): si el límite de turnos se agotase sin ganador -- indicio real de
// que algo rompió la convergencia, no algo a esconder -- el test falla en
// vez de disfrazarlo con el modal forzado.
const MAPA_SEMBRADO = "calma-de-los-restos";
const MAXIMO_TURNOS_JUGADOS = 12;

test("partida de punta a punta a 360x640 con el encuadre nuevo, jugada hasta que hay un ganador real", async ({ page }) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("boton-jugar").click();

  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // encuadre-movil-1: el mundo que quedó activo no es el 1920x1080 fijo de
  // antes -- confirma que configurarTamanoMundo se aplicó de verdad en esta
  // misma partida, no solo en el test unitario aislado.
  const mundo = await page.evaluate(() => window.__debug.mundo!);
  expect(mundo.ancho).not.toBe(1920);
  expect(mundo.alto).not.toBe(1080);

  await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-01-inicio-360x640.png" });

  let numeroTurnoEsperado = 0;
  let huboVueloCapturado = false;
  for (let i = 0; i < MAXIMO_TURNOS_JUGADOS; i++) {
    const estado = await page.evaluate(() => ({
      naves: window.__debug.naves!,
      parteDeGuerra: window.__debug.parteDeGuerra,
    }));
    if (estado.parteDeGuerra !== null || estado.naves.some((nave) => nave.integridad <= 0)) break;

    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
    expect(solucion, `turno ${i}: la solución balística exacta debe existir en un mapa de deriva 0`).not.toBeNull();

    const fraccionAngulo = (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
    const fraccionPotencia = (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
    await arrastrarBarraHasta(page, "barra-angulo", fraccionAngulo);
    await arrastrarBarraHasta(page, "barra-potencia", fraccionPotencia);

    if (i === 0) {
      await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-02-apuntado-360x640.png" });
    }

    numeroTurnoEsperado += 2; // el disparo del jugador y la respuesta de la IA, el mismo ciclo que control-1
    await page.getByTestId("disparar").click();

    if (!huboVueloCapturado) {
      await page.waitForFunction(() => window.__debug.animacionEnCurso === true);
      await page.waitForTimeout(150);
      await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-03-vuelo-360x640.png" });
      huboVueloCapturado = true;
    }

    await page.waitForFunction(
      (numeroEsperado) =>
        window.__debug.parteDeGuerra !== null ||
        (window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= numeroEsperado && window.__debug.animacionEnCurso === false),
      numeroTurnoEsperado,
      { timeout: 20000 },
    );
  }

  const naves = await page.evaluate(() => window.__debug.naves!);
  expect(
    naves.some((nave) => nave.integridad <= 0),
    `una partida real con solución exacta y arma de serie debe acabar en ${MAXIMO_TURNOS_JUGADOS} turnos o menos`,
  ).toBe(true);
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-04-impacto-360x640.png" });

  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
  await page.screenshot({ path: "test-results/encuadre-movil-4/encuadre-movil-7-05-ganador-360x640.png" });
});
