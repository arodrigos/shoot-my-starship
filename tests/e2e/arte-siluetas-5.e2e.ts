import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
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

// Elementos de HUD opacos que pueden tapar el proyectil DENTRO del lienzo
// (el único que importa aquí: la consola vive fuera de la zona de juego) --
// mismo criterio que proy-5, reducido a los botones fixed que flotan sobre
// el propio lienzo (historico-bromas-toggle, toggle-sacudida,
// toggle-silenciado).
const TESTIDS_HUD_SOBRE_LIENZO = ["historico-bromas-toggle", "toggle-sacudida", "toggle-silenciado"];
const MARGEN_VISIBILIDAD_PX = 14;

// arte-siluetas-5 (quinta corrección): la cuarta elegía el instante de la
// captura midiendo la posición de MUNDO del proyectil a los 500ms, sin
// comprobar dónde caía esa posición en PANTALLA ni si algo se pintaba
// encima -- el gatekeeper lo verificó restando capturas y muestreando
// window.__debug.proyectilEnVuelo frame a frame: a los 500ms el proyectil
// estaba justo debajo del botón opaco "Histórico", y desde ~700ms salía por
// encima del borde superior de la zona de juego. Aquí se sondea DENTRO del
// propio vuelo (no una espera fija, issue #151) hasta encontrar un
// fotograma en el que el proyectil, convertido a coordenadas de pantalla
// con window.__debug.mundo (MUNDO_ANCHO/ALTO ya no son fijos, ver
// encuadre-movil) caiga dentro del lienzo y lejos de los botones fixed que
// lo tapan.
// arte-siluetas-5 (octava corrección): la quinta corrección comprobaba la
// posición con page.evaluate() y LUEGO pedía la foto con page.screenshot(),
// dos llamadas separadas por el puente CDP -- el gatekeeper midió que el
// proyectil cruza el lienzo en menos de 80ms, así que para cuando el
// obturador disparaba ya habían pasado varios fotogramas y la imagen salía
// vacía aunque la comprobación hubiera dado "visible". Aquí la posición y
// la captura salen del MISMO page.evaluate(): canvas.toDataURL() lee los
// píxeles ya pintados en el instante exacto en que se confirmó la posición,
// sin ceder el hilo de JS entre medias (no hay frame posible que se cuele).
async function capturarLienzoSiProyectilVisible(page: Page): Promise<string | null> {
  return page.evaluate(
    ({ testIds, margen }) => {
      const proyectil = window.__debug.proyectilEnVuelo;
      const mundo = window.__debug.mundo;
      const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement | null;
      if (!proyectil || !mundo || lienzo === null) return null;

      const rectLienzo = lienzo.getBoundingClientRect();
      const pantalla = {
        x: rectLienzo.left + (proyectil.x / mundo.ancho) * rectLienzo.width,
        y: rectLienzo.top + (proyectil.y / mundo.alto) * rectLienzo.height,
      };

      const dentroDelLienzo =
        pantalla.x >= rectLienzo.left + margen &&
        pantalla.x <= rectLienzo.left + rectLienzo.width - margen &&
        pantalla.y >= rectLienzo.top + margen &&
        pantalla.y <= rectLienzo.top + rectLienzo.height - margen;
      if (!dentroDelLienzo) return null;

      const tapado = testIds.some((testId) => {
        const el = document.querySelector(`[data-testid="${testId}"]`);
        if (el === null) return false;
        const b = el.getBoundingClientRect();
        return (
          pantalla.x >= b.left - margen &&
          pantalla.x <= b.right + margen &&
          pantalla.y >= b.top - margen &&
          pantalla.y <= b.bottom + margen
        );
      });
      if (tapado) return null;

      // mismo tick de JS que la comprobación de arriba: el canvas 2D no
      // vuelve a pintar hasta el siguiente requestAnimationFrame, así que
      // esto es exactamente lo que se acaba de medir, no un instante
      // posterior.
      return lienzo.toDataURL("image/png");
    },
    { testIds: TESTIDS_HUD_SOBRE_LIENZO, margen: MARGEN_VISIBILIDAD_PX },
  );
}

function pngDesdeDataUrl(dataUrl: string): PNG {
  return PNG.sync.read(Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
}

// Sondea mientras el vuelo real está en curso (nunca una espera fija) hasta
// encontrar un fotograma visible, o hasta que el vuelo termine sin dar
// ninguno -- en cuyo caso el turno siguiente lo vuelve a intentar con la
// trayectoria real de esa nueva posición, en vez de forzar un instante que
// no se puede defender. `basal` es un lienzo sin proyectil (el mismo mapa,
// tomado antes de disparar) para que la aserción final sea sobre la IMAGEN
// -- que el fotograma capturado difiera de verdad del fondo, no solo que la
// comprobación de posición haya dado "visible" (issue del gatekeeper,
// séptima vuelta: "lo que pasó fue la comprobación, no la foto").
async function intentarCapturarVueloVisible(page: Page, ruta: string, basal: PNG): Promise<boolean> {
  const limite = Date.now() + 8000;
  while (Date.now() < limite) {
    const enVuelo = await page.evaluate(() => window.__debug.animacionEnCurso === true);
    if (!enVuelo) return false;
    const dataUrl = await capturarLienzoSiProyectilVisible(page);
    if (dataUrl !== null) {
      const capturado = pngDesdeDataUrl(dataUrl);
      if (capturado.width === basal.width && capturado.height === basal.height) {
        const diferentes = pixelmatch(basal.data, capturado.data, undefined, capturado.width, capturado.height, {
          threshold: 0.1,
        });
        // Un proyectil de verdad pintado mueve de sitio más píxeles que el
        // ruido de antialiasing entre dos capturas idénticas (medido: por
        // debajo de 20 entre dos lecturas del mismo fondo quieto).
        if (diferentes > 20) {
          writeFileSync(ruta, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
          return true;
        }
      }
    }
    await page.waitForTimeout(40);
  }
  return false;
}

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

    // Fondo SIN proyectil de este mismo turno (naves y terreno ya en su
    // sitio, justo antes de disparar) -- la referencia contra la que se
    // mide si el fotograma de vuelo capturado de verdad pintó algo encima.
    const basal = !huboVueloCapturado
      ? pngDesdeDataUrl((await page.evaluate(() => (document.querySelector("#game-container canvas") as HTMLCanvasElement).toDataURL("image/png"))))
      : null;

    numeroTurnoEsperado += 2; // el disparo del jugador y la respuesta de la IA
    await page.getByTestId("disparar").click();

    // Vuelo: el proyectil ya en el aire, lejos de la nave que dispara,
    // orientado a su velocidad (arte-siluetas-2) y de verdad visible en
    // PANTALLA -- si este turno no da ningún fotograma así, el siguiente lo
    // reintenta con la trayectoria real de la nueva posición.
    if (!huboVueloCapturado && basal !== null) {
      await page.waitForFunction(() => window.__debug.animacionEnCurso === true);
      huboVueloCapturado = await intentarCapturarVueloVisible(page, "capturas/arte-siluetas-5-2-vuelo-360x640.png", basal);
    }

    await page.waitForFunction(
      (numeroEsperado) =>
        window.__debug.parteDeGuerra !== null ||
        (window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= numeroEsperado && window.__debug.animacionEnCurso === false),
      numeroTurnoEsperado,
      { timeout: 20000 },
    );
  }

  expect(
    huboVueloCapturado,
    "ningún fotograma del vuelo cayó dentro del lienzo y lejos de los botones fixed del HUD en ningún turno jugado",
  ).toBe(true);

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
