import { test, expect } from "@playwright/test";
import { arrastrarBarraHasta } from "./utilesControl";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { simularVuelo } from "@/sim/fisica/vuelo";
import type { EstadoProyectil } from "@/sim/fisica/proyectil";
import type { DebugUltimoDisparo } from "@/debug/tipos";

async function entrarAPartidaEspacial(page: import("@playwright/test").Page): Promise<void> {
  // Sin ?mapa=: es el hito espacial, el único modo con planetas (ver
  // tests/e2e/fondo-y-pozos.e2e.ts) -- el único sitio donde el pozo de
  // gravedad y la curvatura real de la previsualización tienen algo que
  // enseñar.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

function fraccionDeAngulo(grados: number): number {
  return (grados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
}

function fraccionDePotencia(porcentaje: number): number {
  return (porcentaje - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
}

// gravedad-visible-3 (camino crítico): mover la potencia cambia visiblemente
// la curva previsualizada -- es lo que enseña para qué sirve elegir la
// fuerza del disparo. Mismo ángulo, dos potencias (30% y 90%), y se mide la
// separación máxima en PÍXELES DE PANTALLA (no de mundo) entre los dos
// trazados, punto a punto por índice de paso -- los dos tiros parten del
// mismo origen y el primer punto es casi idéntico, así que la curva tiene
// que abrirse más adelante si la potencia influye de verdad.
test("gravedad-visible-3: potencia 30% y 90% producen previsualizaciones que se separan más de 40px de pantalla", async ({ page }) => {
  test.setTimeout(60000);
  await entrarAPartidaEspacial(page);

  const mundo = (await page.evaluate(() => window.__debug.mundo))!;
  const anchoLienzoPx = await page.evaluate(() => {
    const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement;
    return lienzo.getBoundingClientRect().width;
  });
  const escalaEfectiva = anchoLienzoPx / mundo.ancho;

  // 95°, no 55°: con la semilla por defecto, a 55° el tiro de potencia alta
  // termina su vuelo real (y por tanto su previsualización, recortada por
  // pvr-2 antes de revelar el impacto) en muy pocos pasos -- la ventana
  // comparable entre los dos trazados se cierra antes de que la curva llegue
  // a abrirse. A 95° los dos vuelos son largos de verdad y sí divergen.
  await arrastrarBarraHasta(page, "barra-angulo", fraccionDeAngulo(95));

  // gravedad-visible-5 oculta la mira el fotograma en que calcularla supera
  // su presupuesto de cómputo (una pausa de GC, contención de CPU en el
  // runner) -- eso no es el disparo bajo prueba aquí, así que no se lee
  // window.__debug.previsualizacion en el primer fotograma tras el ajuste:
  // se espera (con timeout generoso, nunca un sleep fijo) a que el bucle de
  // la escena, que recalcula cada fotograma mientras jugable, vuelva a
  // publicar un trazado real.
  await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(30));
  await page.waitForFunction(() => Math.abs(window.__debug.control!.ajuste.potencia - 30) <= 1);
  await page.waitForFunction(() => (window.__debug.previsualizacion?.puntos.length ?? 0) >= 2, undefined, { timeout: 10000 });
  const previsualizacionBaja = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionBaja?.puntos.length ?? 0).toBeGreaterThanOrEqual(2);

  await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(90));
  await page.waitForFunction(() => Math.abs(window.__debug.control!.ajuste.potencia - 90) <= 1);
  await page.waitForFunction(() => (window.__debug.previsualizacion?.puntos.length ?? 0) >= 2, undefined, { timeout: 10000 });
  const previsualizacionAlta = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacionAlta?.puntos.length ?? 0).toBeGreaterThanOrEqual(2);

  const puntosBaja = previsualizacionBaja!.puntos;
  const puntosAlta = previsualizacionAlta!.puntos;
  const minimoComun = Math.min(puntosBaja.length, puntosAlta.length);

  let separacionMaximaPx = 0;
  for (let i = 0; i < minimoComun; i++) {
    const dx = (puntosBaja[i].x - puntosAlta[i].x) * escalaEfectiva;
    const dy = (puntosBaja[i].y - puntosAlta[i].y) * escalaEfectiva;
    separacionMaximaPx = Math.max(separacionMaximaPx, Math.hypot(dx, dy));
  }

  expect(separacionMaximaPx).toBeGreaterThan(40);
});

// gravedad-visible-4 (camino crítico): de punta a punta -- se apunta con
// preview, se dispara, el proyectil pasa por los puntos previsualizados y
// el turno se resuelve con su efecto y pasa al siguiente. `solucionMultipozoJugador`
// (imp-11) da un ángulo/potencia con daño > 0 verificado contra el resolutor
// real, así que el impacto (y no solo el disparo) queda garantizado sin
// depender de apuntar a ciegas en un campo con gravedad.
test("gravedad-visible-4: el proyectil real pasa por los puntos previsualizados y el turno se resuelve y avanza", async ({ page }) => {
  test.setTimeout(60000);
  await entrarAPartidaEspacial(page);

  const solucion = await page.evaluate(() => window.__debug.solucionMultipozoJugador!());
  expect(solucion).not.toBeNull();
  expect(solucion!.danio).toBeGreaterThan(0);

  await arrastrarBarraHasta(page, "barra-angulo", fraccionDeAngulo(solucion!.anguloGrados));
  await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(solucion!.potencia));
  await page.waitForFunction(
    (esperado) => Math.abs(window.__debug.control!.ajuste.anguloGrados - esperado) <= 1,
    solucion!.anguloGrados,
  );
  await page.waitForFunction(
    (esperado) => Math.abs(window.__debug.control!.ajuste.potencia - esperado) <= 1,
    solucion!.potencia,
  );
  // Mismo motivo que en gravedad-visible-3: esperar al trazado real en vez
  // de leer el fotograma justo tras el ajuste, que puede caer sobre un
  // ciclo en el que grav-vis-5 ocultó la mira por presupuesto de cómputo.
  await page.waitForFunction(() => (window.__debug.previsualizacion?.puntos.length ?? 0) >= 2, undefined, { timeout: 10000 });

  const previsualizacion = await page.evaluate(() => window.__debug.previsualizacion);
  expect(previsualizacion?.puntos.length ?? 0).toBeGreaterThanOrEqual(2);
  const puntosPrevistos = previsualizacion!.puntos;

  // Misma trampa de captura que mos-3: el turno de respuesta de la IA
  // sobrescribe ultimoDisparo/trayectoriaAnimadaUltimoVuelo síncronamente
  // antes de que ningún poll llegue a verlos, así que hay que quedarse con
  // la PRIMERA escritura (la del disparo del jugador).
  await page.evaluate(() => {
    const debug = window.__debug as unknown as { _trayectoriaAnimadaUltimoVuelo?: unknown };
    let capturado = false;
    Object.defineProperty(window.__debug, "trayectoriaAnimadaUltimoVuelo", {
      configurable: true,
      get() {
        return debug._trayectoriaAnimadaUltimoVuelo;
      },
      set(v) {
        debug._trayectoriaAnimadaUltimoVuelo = v;
        if (!capturado) {
          capturado = true;
          (window as unknown as { __gravVisCaptura: unknown }).__gravVisCaptura = {
            trayectoria: v,
            disparo: window.__debug.ultimoDisparo,
          };
        }
      },
    });
  });

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();

  await page.waitForFunction(() => (window as unknown as { __gravVisCaptura?: unknown }).__gravVisCaptura !== undefined, undefined, {
    timeout: 30000,
  });
  await page.waitForFunction(
    (n) => window.__debug.animacionEnCurso === false && (window.__debug.numeroTurno ?? 0) >= n + 1,
    numeroTurnoAntes,
    { timeout: 30000 },
  );

  const captura = await page.evaluate(
    () => (window as unknown as { __gravVisCaptura: { trayectoria: readonly { x: number; y: number }[]; disparo: DebugUltimoDisparo } }).__gravVisCaptura,
  );
  const trayectoriaAnimada = captura.trayectoria;
  const ultimoDisparo = captura.disparo;
  expect(trayectoriaAnimada).toBeDefined();
  expect(ultimoDisparo?.inicial).toBeDefined();

  const pasosAnimados = trayectoriaAnimada.length - 1;
  let contador = 0;
  const detenerseTrasNPasos = () => contador++ >= pasosAnimados;
  const resuelto = simularVuelo(ultimoDisparo!.inicial as EstadoProyectil, ultimoDisparo!.gravedad!, ultimoDisparo!.deriva!, detenerseTrasNPasos, {
    grabarTrayectoria: true,
    planetas: ultimoDisparo!.planetas,
  });
  const trayectoriaReal = resuelto.trayectoria!;

  // El proyectil real pasa por los puntos previsualizados: los primeros
  // puntos de la trayectoria real coinciden, dentro de 1px, con lo que se
  // enseñó antes de disparar.
  for (let i = 0; i < puntosPrevistos.length && i < trayectoriaReal.length; i++) {
    const previsto = puntosPrevistos[i];
    const real = trayectoriaReal[i];
    expect(Math.hypot(previsto.x - real.x, previsto.y - real.y), `paso ${i}`).toBeLessThanOrEqual(1);
  }

  // El turno se resuelve con su efecto (daño aplicado, ya verificado por
  // solucionMultipozoJugador) y pasa al siguiente.
  const resultadoTurno = await page.evaluate(() => window.__debug.resultadoTurno);
  expect(resultadoTurno).toBeTruthy();

  await page.screenshot({ path: "capturas/gravedad-visible-4-turno-resuelto-360x640.png" });
});
