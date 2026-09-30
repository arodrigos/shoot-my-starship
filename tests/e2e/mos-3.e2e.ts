import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { buscarArma } from "@/sim/armas/catalogo";
import type { EstadoProyectil } from "@/sim/fisica/proyectil";
import type { DebugUltimoDisparo } from "@/debug/tipos";

interface CapturaMosca {
  readonly trayectoria: readonly { readonly x: number; readonly y: number }[];
  readonly disparo: DebugUltimoDisparo;
}

// mos-3 (camino crítico): elegir la mosca, apuntar, disparar, y que la
// trayectoria ANIMADA (lo que de verdad ve el jugador) nunca diverja más de
// 1px por paso de la trayectoria RESUELTA por el núcleo para ese mismo
// disparo -- comparando window.__debug.trayectoriaAnimadaUltimoVuelo contra
// simularVuelo() vuelto a llamar en Node con los mismos insumos exactos
// (window.__debug.ultimoDisparo: inicial/gravedad/deriva/aleatorioAntes),
// nunca con una copia reimplementada de la física.
//
// Se navega con ?mapa=calma-de-los-restos (deriva 0, sin planetas) para que
// solucionBalisticaJugador dé una solución exacta y determinista, igual que
// control-1.
test("mos-3: la trayectoria animada de la mosca coincide, paso a paso, con la resuelta por el núcleo para el mismo disparo", async ({
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

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("arma-mosca-cojonera").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "mosca-cojonera");

  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();

  const fraccionAngulo = (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
  const fraccionPotencia = (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
  await arrastrarBarraHasta(page, "barra-angulo", fraccionAngulo);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionPotencia);

  // El turno del jugador termina y encadena SÍNCRONAMENTE (mismo callback,
  // sin frame real de por medio -- ver dispararTurnoIA en Partida.ts) con el
  // disparo de respuesta de la máquina, que sobrescribe
  // window.__debug.ultimoDisparo/trayectoriaAnimadaUltimoVuelo con SU arma
  // antes de que ningún poll de Playwright llegue a observar el estado
  // intermedio (ver el mismo hueco que documenta proy-5). Se instala una
  // trampa de captura ANTES de disparar -- solo instrumentación de test,
  // nada de producción -- que se queda con la PRIMERA escritura de
  // trayectoriaAnimadaUltimoVuelo (la del propio disparo del jugador) antes
  // de que la de la máquina la pise.
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
          (window as unknown as { __mosCaptura: unknown }).__mosCaptura = {
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

  await page.waitForFunction(() => (window as unknown as { __mosCaptura?: unknown }).__mosCaptura !== undefined, undefined, {
    timeout: 30000,
  });
  await page.waitForFunction(
    (n) => window.__debug.animacionEnCurso === false && (window.__debug.numeroTurno ?? 0) >= n + 1,
    numeroTurnoAntes,
    { timeout: 30000 },
  );

  const captura = await page.evaluate(() => (window as unknown as { __mosCaptura: CapturaMosca }).__mosCaptura);
  const trayectoriaAnimada = captura.trayectoria;
  const ultimoDisparo = captura.disparo;
  expect(trayectoriaAnimada).toBeDefined();
  expect(ultimoDisparo?.armaId).toBe("mosca-cojonera");
  expect(ultimoDisparo?.inicial).toBeDefined();
  expect(ultimoDisparo?.aleatorioAntes).toBeDefined();

  const arma = buscarArma("mosca-cojonera");
  if (arma.comportamiento.tipo !== "erratico") throw new Error("mosca-cojonera dejó de declararse erratico");
  const magnitudPxS2 = arma.comportamiento.magnitudPxS2;

  // Exactamente los mismos pasos que dio la animación (ver comentario en
  // simularVuelo: detenerse() se consulta ANTES de cada paso) -- no hace
  // falta reproducir el terreno real en Node, solo la misma física por el
  // mismo número de pasos.
  const pasosAnimados = trayectoriaAnimada!.length - 1;
  let contador = 0;
  const detenerseTrasNPasos = () => contador++ >= pasosAnimados;

  const resuelto = simularVuelo(
    ultimoDisparo!.inicial as EstadoProyectil,
    ultimoDisparo!.gravedad!,
    ultimoDisparo!.deriva!,
    detenerseTrasNPasos,
    {
      grabarTrayectoria: true,
      perturbacion: { magnitudPxS2, aleatorio: ultimoDisparo!.aleatorioAntes! },
    },
  );

  expect(resuelto.trayectoria!.length).toBe(trayectoriaAnimada!.length);
  for (let i = 0; i < trayectoriaAnimada!.length; i++) {
    const animado = trayectoriaAnimada![i];
    const nucleo = resuelto.trayectoria![i];
    const separacion = Math.hypot(animado.x - nucleo.x, animado.y - nucleo.y);
    expect(separacion, `paso ${i}: animado (${animado.x}, ${animado.y}) vs núcleo (${nucleo.x}, ${nucleo.y})`).toBeLessThanOrEqual(1);
  }
});
