import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// arte-siluetas-5 (camino_critico, cuarta corrección): las tres vueltas
// anteriores jugaban UN disparo cualquiera y llamaban a
// forzarFinDePartida() para llegar al modal de ganador -- eso prueba que el
// modal existe, no que una partida se juega de punta a punta con impactos
// reales. Mismo patrón que encuadre-movil-4 (solución balística exacta de
// window.__debug, mapa de deriva 0 para que converja en pocos turnos):
// aquí lo que se compara no es el marcador de integridad sino las tres
// capturas que pide el criterio, tomadas con el encuadre, el HUD y la
// gravedad de hoy -- forzarFinDePartida() se conserva solo como red de
// seguridad si el límite de turnos se agota sin ganador, nunca como camino
// normal.
const MAPA_SEMBRADO = "calma-de-los-restos";
const MAXIMO_TURNOS_JUGADOS = 12;

test("recorrido completo a 360x640 con capturas en apuntado, vuelo e impacto", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });

  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("rival-almirante-bisagra").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mapa !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // Apuntado: las dos naves y el HUD visibles antes de cualquier disparo --
  // arte-siluetas-3 (silueta + indicador de nave propia) se lee aquí.
  await page.screenshot({ path: "capturas/arte-siluetas-5-1-apuntado-360x640.png" });

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

    numeroTurnoEsperado += 2; // el disparo del jugador y la respuesta de la IA
    await page.getByTestId("disparar").click();

    // Vuelo: el proyectil ya en el aire, lejos de la nave que dispara y
    // orientado a su velocidad (arte-siluetas-2) -- se captura en el primer
    // disparo. Esperar solo animacionEnCurso daba una captura tomada a los
    // 150ms del disparo, con el proyectil todavía pegado al cañón y
    // confundible con la propia nave; 500ms (medido con
    // window.__debug.proyectilEnVuelo frame a frame) ya lo separa con
    // claridad sin arriesgarse a que el vuelo entero haya terminado.
    if (!huboVueloCapturado) {
      await page.waitForFunction(() => window.__debug.animacionEnCurso === true);
      await page.waitForTimeout(500);
      await page.screenshot({ path: "capturas/arte-siluetas-5-2-vuelo-360x640.png" });
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
  expect(naves.some((nave) => nave.integridad > 0)).toBe(true);

  // Impacto/resultado: el parte de guerra con un ganador real, tras un
  // impacto real -- no el modal forzado tras un único disparo cualquiera.
  await page.waitForTimeout(150);
  await page.screenshot({ path: "capturas/arte-siluetas-5-3-impacto-360x640.png" });
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
});
