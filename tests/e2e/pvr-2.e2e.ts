import { test, expect } from "@playwright/test";
import { DISTANCIA_MINIMA_OCULTA_IMPACTO_PX, PASOS_PREVISUALIZACION_ERRATICO } from "@/sim/armas/previsualizacion";
import { arrastrarBarraHasta } from "./utilesControl";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import type { DebugUltimoDisparo } from "@/debug/tipos";

// pvr-2 (camino crítico): "sigue habiendo juego" -- la mira nunca revela
// dónde va a caer el tiro, desaparece durante el vuelo, y para la mosca se
// corta mucho antes que para el resto. La verificación punto a punto de
// calcularPrevisualizacion ya vive en tests/unit/prevision-real/pvr-2.test.ts
// (200 combinaciones deterministas contra el oráculo real); lo que falta
// aquí, sobre el juego real en el navegador, es que el valor que de verdad
// se publica en window.__debug (lo que el jugador vería si pudiera leerlo)
// respeta esas mismas garantías con un disparo real de principio a fin.
//
// Ángulo 75°/potencia 0 en ?mapa=calma-de-los-restos (deriva 0, gravedad
// 0,85, sin planetas): un lob casi vertical y corto que aterriza dentro de
// la ventana de previsualización (90 pasos/1,5s) -- condición necesaria
// para ejercer el recorte por DISTANCIA_MINIMA_OCULTA_IMPACTO_PX en vez de
// el camino (ya cubierto por su propio test) donde el presupuesto de pasos
// corta primero y no hay nada que ocultar. Medido una vez contra el build
// real: 56 puntos dibujados, último punto a ~41px del impacto resuelto.
test("pvr-2: el último punto dibujado nunca revela el impacto, la mira se oculta al disparar, y la mosca se corta mucho antes", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const anguloObjetivo = 75;
  const potenciaObjetivo = 0;
  const fraccionAngulo = (anguloObjetivo - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
  const fraccionPotencia = (potenciaObjetivo - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
  await arrastrarBarraHasta(page, "barra-angulo", fraccionAngulo);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionPotencia);
  await page.waitForFunction(
    () => Math.abs(window.__debug.control!.ajuste.anguloGrados - 75) <= 0.5 && window.__debug.control!.ajuste.potencia === 0,
  );

  const previsualizacionAntes = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionAntes?.puntos.length ?? 0).toBeGreaterThanOrEqual(2);

  // Trampa de captura (mismo patrón que mos-3): el disparo de respuesta de
  // la máquina sobrescribe window.__debug.ultimoDisparo en el mismo
  // callback síncrono, antes de que ningún poll llegue a ver el estado
  // intermedio -- se queda con la PRIMERA escritura que ya trae impactoReal
  // (la del propio disparo del jugador, fijada en el callback de vuelo
  // ANTES de encadenar el turno de la máquina).
  await page.evaluate(() => {
    let valorActual: DebugUltimoDisparo | undefined;
    let capturado = false;
    Object.defineProperty(window.__debug, "ultimoDisparo", {
      configurable: true,
      get() {
        return valorActual;
      },
      set(v: DebugUltimoDisparo | undefined) {
        valorActual = v;
        if (!capturado && v?.impactoReal) {
          capturado = true;
          (window as unknown as { __pvrCaptura: DebugUltimoDisparo }).__pvrCaptura = v;
        }
      },
    });
  });

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  // pvr-2: la mira se oculta durante el vuelo real -- mismo gate `jugable`
  // que el resto de la vista, sin caso especial.
  await page.waitForFunction(() => window.__debug.animacionEnCurso === true, undefined, { timeout: 15000 });
  const previsualizacionDuranteVuelo = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionDuranteVuelo).toBeNull();

  await page.waitForFunction(() => (window as unknown as { __pvrCaptura?: DebugUltimoDisparo }).__pvrCaptura !== undefined, undefined, {
    timeout: 30000,
  });
  const captura = await page.evaluate(() => (window as unknown as { __pvrCaptura: DebugUltimoDisparo }).__pvrCaptura);
  expect(captura.impactoReal).toBeDefined();

  const ultimo = previsualizacionAntes!.puntos[previsualizacionAntes!.puntos.length - 1];
  const distancia = Math.hypot(ultimo.x - captura.impactoReal!.x, ultimo.y - captura.impactoReal!.y);
  expect(
    distancia,
    `el último punto dibujado (${ultimo.x}, ${ultimo.y}) quedó a ${distancia}px del impacto real (${captura.impactoReal!.x}, ${captura.impactoReal!.y})`,
  ).toBeGreaterThanOrEqual(DISTANCIA_MINIMA_OCULTA_IMPACTO_PX);

  // Caso específico de la mosca: una partida nueva, elegir la mosca y
  // comprobar que su mira publicada en window.__debug nunca se alarga más
  // allá del tramo cortísimo que le corresponde (pvr-2 en
  // tests/unit/prevision-real/pvr-2.test.ts ya prueba esto contra la
  // función pura; aquí se prueba que Partida.ts publica ese mismo límite,
  // no uno propio inventado en el cliente).
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("arma-mosca-cojonera").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "mosca-cojonera");

  const previsualizacionMosca = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionMosca?.puntos.length ?? 0).toBeGreaterThan(0);
  expect(previsualizacionMosca!.puntos.length).toBeLessThanOrEqual(PASOS_PREVISUALIZACION_ERRATICO + 1);
});
