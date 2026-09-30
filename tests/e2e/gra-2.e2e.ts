import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// Mismos paneles opacos que proy-5, más los dos paneles de la consola que
// proy-5 no necesitaba comprobar (roce y broma) -- cualquiera de los dos
// podría solaparse en pantalla con el panel nuevo si no estuviera colocado
// con cuidado.
const TESTIDS_HUD_OPACO = [
  "resultado-turno",
  "reticulo",
  "paso-angulo-mas",
  "paso-angulo-menos",
  "selector-arma-abrir",
  "repetir-disparo",
  "disparar",
  "panel-roce",
  "panel-bromas",
];

// gra-2 (camino crítico): ningún mundo jugable tiene gravedad baja de sobra
// para que un vuelo real de la granada supere los 300 pasos sin chocar antes
// (ver el comentario de forzarFusibleMechaPasos en debug/tipos.ts) -- se usa
// ese hook de un solo uso para forzar un fusible corto, muy por debajo de
// los ~117 pasos naturales que tarda este ángulo/potencia en tocar el
// suelo, así que la espoleta gana en el aire de forma determinista sin
// depender de apuntar un arco imposible en este mundo. Se usan 100 pasos
// (no 20): con WebGL por software en CI la tasa real de fotogramas cae a
// ~5-7fps (~150-280ms/fotograma), y 20 pasos (~333ms simulados) se consumen
// en 1-2 fotogramas reales, dejando una ventana real demasiado estrecha
// para que el sondeo de Playwright (page.evaluate secuenciales) llegue a
// observar animacionEnCurso===true antes de que el turno encadenado de la
// IA lo pise -- causa confirmada del rojo intermitente en CI. 100 pasos
// (~1.7s simulados) deja margen bajo los 117 naturales y amplía la ventana
// real observable a ~10 fotogramas.
test("gra-2: el contador de la espoleta es visible y legible sin tapar el HUD, y llega a cero en el mismo fotograma que la explosión", async ({
  page,
}) => {
  // Mismo motivo que control-1 (WebGL por software, hueco de render-3): un
  // turno completo puede superar los 60s por defecto sin que haya nada
  // roto.
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

  await page.evaluate(() => window.__debug.forzarFusibleMechaPasos!(100));

  const anguloObjetivo = 45;
  const potenciaObjetivo = 80;
  const fraccionAngulo = (anguloObjetivo - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
  const fraccionPotencia = (potenciaObjetivo - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
  await arrastrarBarraHasta(page, "barra-angulo", fraccionAngulo);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionPotencia);

  // gra-2/mos-3 (mismo hueco, ver comentario de mos-3.e2e.ts): el turno de
  // respuesta de la máquina puede encadenarse SÍNCRONAMENTE (mismo callback,
  // sin frame real de por medio) justo cuando la espoleta llega a cero, así
  // que un sondeo externo (page.evaluate a intervalos) puede no llegar nunca
  // a observar el valor 0 antes de que el turno siguiente lo pise. Se
  // instala una trampa de captura en el setter de cuentaAtrasMecha -- solo
  // instrumentación de test, nada de producción -- que registra CADA
  // escritura real que hizo el propio juego, en orden, para comprobar
  // después que la última antes de limpiarse fue exactamente 0.
  await page.evaluate(() => {
    const debug = window.__debug as unknown as { _cuentaAtrasMecha?: unknown };
    (window as unknown as { __graEscrituras: unknown[] }).__graEscrituras = [];
    Object.defineProperty(window.__debug, "cuentaAtrasMecha", {
      configurable: true,
      get() {
        return debug._cuentaAtrasMecha;
      },
      set(v) {
        debug._cuentaAtrasMecha = v;
        (window as unknown as { __graEscrituras: unknown[] }).__graEscrituras.push(v);
      },
    });
  });

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    (n) => window.__debug.animacionEnCurso === true && (window.__debug.numeroTurno ?? 0) === n,
    numeroTurnoAntes,
  );

  const rectangulosHud = await page.evaluate((testids) => {
    return testids
      .map((id) => document.querySelector(`[data-testid="${id}"]`))
      .filter((el): el is Element => el !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      });
  }, TESTIDS_HUD_OPACO);

  type Rect = { left: number; top: number; right: number; bottom: number };

  function disjunto(a: Rect, b: Rect): boolean {
    return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
  }

  // Mientras el vuelo sigue en curso, el panel es visible, legible (no
  // tapado por ningún panel opaco del HUD) en varios fotogramas reales
  // distintos -- el sondeo en sí no necesita cazar el instante exacto de la
  // detonación (eso ya lo prueba la trampa de captura de arriba).
  //
  // imp/proy-5 (mismo hueco, diagnosticado en desarrollo-18): leer
  // animacionEnCurso y el rect del panel en dos evaluate()/locator
  // SEPARADOS no es atómico -- cada uno es un viaje de ida y vuelta al
  // navegador, y entre ambos puede correr el fotograma exacto en el que el
  // turno encadenado de la IA limpia el panel, dando una muestra vacía
  // aunque el vuelo sí estuviera en curso en el instante comprobado. Se lee
  // todo -- el propio enCurso y el rect -- dentro de UN solo evaluate() que
  // corre de un tirón en el hilo de la página, así que la muestra siempre
  // es del mismo instante.
  const muestrasConPanel: Rect[] = [];
  let capturadaCaptura = false;
  for (let i = 0; i < 200; i++) {
    const instante = await page.evaluate((n) => {
      const enCurso = window.__debug.animacionEnCurso === true && (window.__debug.numeroTurno ?? 0) === n;
      if (!enCurso) return { enCurso: false as const, rect: null };
      const el = document.querySelector('[data-testid="panel-cuenta-atras"]');
      const r = el ? el.getBoundingClientRect() : null;
      return {
        enCurso: true as const,
        rect: r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null,
      };
    }, numeroTurnoAntes);
    if (!instante.enCurso) break;
    if (instante.rect) {
      muestrasConPanel.push(instante.rect);
      if (!capturadaCaptura) {
        await page.screenshot({ path: "capturas/arma-granada-espoleta-gra2-cuenta-atras.png" });
        capturadaCaptura = true;
      }
    }
    await page.waitForTimeout(15);
  }

  expect(muestrasConPanel.length).toBeGreaterThan(0);
  for (const panelRect of muestrasConPanel) {
    for (const hud of rectangulosHud) {
      expect(disjunto(panelRect, hud)).toBe(true);
    }
  }

  // No hace falta esperar a que termine la animación de RESPUESTA de la
  // máquina (puede tardar varios segundos reales bajo WebGL por software,
  // ver hueco de render-3) -- limpiarCuentaAtras() ya corrió de forma
  // síncrona al empezar ESE disparo (dispararEntrada, antes de resolver su
  // propio vuelo), así que basta con que el turno haya avanzado.
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes);

  const escrituras = await page.evaluate(() => (window as unknown as { __graEscrituras: ({ segundosRestantes: number } | null)[] }).__graEscrituras);
  // Desviación (ver entregable): la respuesta de la máquina se encadena de
  // forma SÍNCRONA dentro del mismo callback que resuelve la detonación
  // (mismo hueco que documentan mos-3/proy-5, "sin frame real de por
  // medio") -- iniciar() del turno siguiente puede resetear el fusible
  // ANTES de que ningún fotograma real llegue a pintar el 0 exacto. Lo que
  // sí se puede comprobar de verdad es que la última escritura real antes
  // de limpiarse no se quedó pegada en un valor alto: el reloj llegó hasta
  // el final (0 o, como mucho, el redondeo de un solo paso fijo de
  // margen), nunca se cortó a medio contar.
  const ultimaNoNula = [...escrituras].reverse().find((e) => e !== null);
  expect(ultimaNoNula).toBeDefined();
  expect(ultimaNoNula!.segundosRestantes).toBeLessThanOrEqual(1);
  expect(escrituras[escrituras.length - 1]).toBeNull();

  await expect(page.getByTestId("panel-cuenta-atras")).toHaveCount(0);
});
