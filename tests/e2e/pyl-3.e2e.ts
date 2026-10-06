import { test, expect } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";
import type { DebugUltimoDisparo } from "@/debug/tipos";

const MUNDO_ANCHO = 1920;
const MUNDO_ALTO = 1080;

interface CapturaPyl3 {
  readonly trayectoria: readonly { readonly x: number; readonly y: number }[];
  readonly disparo: DebugUltimoDisparo;
}

const TESTIDS_HUD_OPACO = [
  "resultado-turno",
  "reticulo",
  "paso-angulo-mas",
  "paso-angulo-menos",
  "selector-arma-abrir",
  "repetir-disparo",
  "disparar",
];

// pyl-3 (camino_critico): un representante por cada una de las ocho
// familias visuales, confirmado contra familiaVisualDe en pyl-1/pyl-2 (no
// elegido a ojo aquí) -- si el catálogo cambiara de armas, ese test unitario
// fallaría antes de que este e2e mintiera sobre qué familia dispara.
const REPRESENTANTE_POR_FAMILIA: Record<string, string> = {
  bomba: "pepinazo-cortesia",
  capsula: "mortero-lamentable",
  racimo: "racimo-de-tuppers",
  chatarra: "pelota-de-chatarra",
  orbe: "graviton-segunda-mano",
  broca: "barrena-planetaria",
  haz: "rayo-laser",
};

for (const [familia, armaId] of Object.entries(REPRESENTANTE_POR_FAMILIA)) {
  test(`pyl-3: familia "${familia}" (${armaId}) -- vuelo visible >=90% y turno cerrado con resultado declarado`, async ({
    page,
  }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/?mapa=calma-de-los-restos");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) {
      await page.getByTestId("ayuda-cerrar").click();
    }

    await page.getByTestId("selector-arma-abrir").click();
    await page.getByTestId(`arma-${armaId}`).click();
    await page.waitForFunction((id) => window.__debug.control!.ajuste.armaId === id, armaId);
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);

    async function arrastrarHasta(anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
      const ajusteAntes = (await page.evaluate(() => window.__debug.control!.ajuste))!;
      const deltaY = -(anguloObjetivo - ajusteAntes.anguloGrados) / GANANCIA_ANGULO_GRADOS;
      const deltaX = (potenciaObjetivo - ajusteAntes.potencia) / GANANCIA_POTENCIA;

      const inicio = { x: 160, y: 560 };
      const fin = { x: inicio.x + deltaX * 360, y: inicio.y + deltaY * 640 };
      await page.mouse.move(inicio.x, inicio.y);
      await page.mouse.down();
      await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
      await page.mouse.move(fin.x, fin.y, { steps: 5 });
      await page.mouse.up();
    }

    // Mismo arco bajo-y-potente que proy-5, deliberadamente reutilizado: se
    // mantiene dentro del campo de batalla para las ocho armas, incluida la
    // instantánea (Rayo Láser), que recorre el mismo arco con gravedad
    // forzada a 0 -- sigue teniendo un vuelo multi-fotograma muestreable
    // (AnimadorProyectil no distingue instantáneo de parabólico).
    await arrastrarHasta(18, 90);

    const rectanguloLienzo = await page.evaluate(() => {
      const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement;
      const r = lienzo.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const rectangulosHud = await page.evaluate((testids) => {
      return testids
        .map((id) => document.querySelector(`[data-testid="${id}"]`))
        .filter((el): el is Element => el !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        });
    }, TESTIDS_HUD_OPACO);

    function mundoAPantalla(x: number, y: number): { x: number; y: number } {
      return {
        x: rectanguloLienzo.left + (x / MUNDO_ANCHO) * rectanguloLienzo.width,
        y: rectanguloLienzo.top + (y / MUNDO_ALTO) * rectanguloLienzo.height,
      };
    }

    function dentroDelLienzo(punto: { x: number; y: number }): boolean {
      return (
        punto.x >= rectanguloLienzo.left &&
        punto.x <= rectanguloLienzo.left + rectanguloLienzo.width &&
        punto.y >= rectanguloLienzo.top &&
        punto.y <= rectanguloLienzo.top + rectanguloLienzo.height
      );
    }

    function tapadoPorHud(punto: { x: number; y: number }): boolean {
      return rectangulosHud.some(
        (r) => punto.x >= r.left && punto.x <= r.right && punto.y >= r.top && punto.y <= r.bottom,
      );
    }

    // arte-siluetas (devuelto en desarrollo-21): la versión anterior medía
    // visibilidad muestreando window.__debug.proyectilEnVuelo cada 30ms de
    // reloj real -- una carrera contra el framerate real de la máquina de
    // CI, no contra el vuelo. Con la gravedad recalibrada (gravedad-
    // calibracion) este arco (18°, potencia 90) resuelve en pocos pasos, así
    // que bajo carga de CPU el muestreo de 30ms a veces solo alcanzaba a ver
    // 0-2 instantes antes de que el vuelo ya hubiera terminado -- el vuelo
    // no era menos visible, era el reloj de la prueba el que no llegaba a
    // tiempo de mirar. mos-3 ya resolvió este mismo problema para su propio
    // criterio: en vez de muestrear en vivo, se instala una trampa ANTES de
    // disparar que captura la ÚNICA escritura de
    // trayectoriaAnimadaUltimoVuelo que pertenece a este disparo (antes de
    // que la respuesta de la IA, encadenada síncronamente, la pise) y se
    // mide sobre ESA trayectoria completa -- paso a paso, la misma que
    // AnimadorProyectil grabó mientras animaba, sin depender de cuántos
    // fotogramas reales cupieron en el vuelo.
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
            (window as unknown as { __pyl3Captura: unknown }).__pyl3Captura = {
              trayectoria: v,
              disparo: window.__debug.ultimoDisparo,
            };
          }
        },
      });
    });

    const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
    await page.getByTestId("disparar").click();

    // Mejor esfuerzo, para el juicio visual del gatekeeper (rubrica.md, eje
    // 6): una captura mientras el proyectil está en pantalla. Ya no hace
    // falta para la aserción de visibilidad (que usa la trayectoria
    // capturada más abajo), así que perderla bajo carga de CPU no hace
    // fallar el test.
    for (let intento = 0; intento < 150; intento++) {
      const estado = await page.evaluate((id) => {
        const p = window.__debug.proyectilEnVuelo;
        const capturado = (window as unknown as { __pyl3Captura?: unknown }).__pyl3Captura !== undefined;
        return { enVuelo: p !== null && p !== undefined && p.armaId === id, capturado };
      }, armaId);
      if (estado.enVuelo) {
        await page.screenshot({ path: `capturas/proyectiles-siluetas-9-pyl3-vuelo-${familia}.png` });
        break;
      }
      if (estado.capturado) break;
      await page.waitForTimeout(10);
    }

    await page.waitForFunction(() => (window as unknown as { __pyl3Captura?: unknown }).__pyl3Captura !== undefined, undefined, {
      timeout: 30000,
    });
    // Punta a punta (pyl-3): el turno avanza y hay un resultado declarado --
    // no basta con que el proyectil se viera, el disparo tiene que cerrar de
    // verdad.
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes, { timeout: 60000 });

    const captura = await page.evaluate(() => (window as unknown as { __pyl3Captura: CapturaPyl3 }).__pyl3Captura);
    const trayectoriaAnimada = captura.trayectoria;
    expect(trayectoriaAnimada).toBeDefined();
    expect(trayectoriaAnimada.length).toBeGreaterThan(2);
    expect(captura.disparo?.armaId).toBe(armaId);

    const visibles = trayectoriaAnimada.filter((punto) => {
      const pantalla = mundoAPantalla(punto.x, punto.y);
      return dentroDelLienzo(pantalla) && !tapadoPorHud(pantalla);
    }).length;
    expect(visibles / trayectoriaAnimada.length).toBeGreaterThanOrEqual(0.9);

    await expect(page.getByTestId("resultado-turno")).toBeVisible();
  });
}
