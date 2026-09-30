import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// min-2 (camino crítico): a diferencia de gra-2 (panel DOM position:fixed),
// el contador de la mina es un GameObject DENTRO del lienzo de Phaser
// (ContadorAdherencia.ts) -- no tiene rect DOM propio que leer. Su
// disjunción del HUD se comprueba por construcción geométrica: si el rect
// del LIENZO entero es disjunto de cada panel del HUD, cualquier cosa
// dibujada dentro del lienzo (incluido el contador) también lo es. Mismo
// motivo que documenta el comentario de ContadorAdherencia.ts.
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

// min-2 (camino crítico): el contador de la mina se ve anclado al punto de
// adherencia (dentro de 2px de mundo del impacto resuelto), disjunto del
// HUD, y llega a cero en el mismo fotograma que la explosión.
test("min-2: el contador de la mina está anclado al punto de adherencia, es disjunto del HUD, y llega a cero con la explosión", async ({
  page,
}) => {
  // Mismo motivo que gra-2/control-1 (WebGL por software, hueco de render-3).
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

  // Mismo hook que gra-2 (forzarFusibleMechaPasos), su equivalente para la
  // mina -- ningún mundo jugable tiene gravedad baja de sobra para que el
  // vuelo natural supere el presupuesto de pasos antes de tocar algo, así
  // que se fuerza una mecha corta y determinista tras la adherencia.
  await page.evaluate(() => window.__debug.forzarFusibleAdherenciaPasos!(100));

  const anguloObjetivo = 45;
  const potenciaObjetivo = 80;
  const fraccionAngulo = (anguloObjetivo - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
  const fraccionPotencia = (potenciaObjetivo - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
  await arrastrarBarraHasta(page, "barra-angulo", fraccionAngulo);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionPotencia);

  // Trampa de captura en el setter de cuentaAtrasAdherencia -- mismo patrón
  // que gra-2 para cuentaAtrasMecha -- porque el turno de respuesta de la
  // IA puede encadenarse síncronamente justo cuando la cuenta llega a cero.
  await page.evaluate(() => {
    const debug = window.__debug as unknown as { _cuentaAtrasAdherencia?: unknown };
    (window as unknown as { __minEscrituras: unknown[] }).__minEscrituras = [];
    Object.defineProperty(window.__debug, "cuentaAtrasAdherencia", {
      configurable: true,
      get() {
        return debug._cuentaAtrasAdherencia;
      },
      set(v) {
        debug._cuentaAtrasAdherencia = v;
        (window as unknown as { __minEscrituras: unknown[] }).__minEscrituras.push(v);
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

  // El impacto resuelto (punto de adherencia real, de núcleo, calculado de
  // forma SÍNCRONA antes de que arranque la animación) es la verdad contra
  // la que se compara la posición del contador.
  const impactoResuelto = await page.evaluate(() => window.__debug.ultimoDisparo!.impacto);

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

  const rectLienzo = await page.evaluate(() => {
    const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement;
    const r = lienzo.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  for (const hud of rectangulosHud) {
    expect(disjunto(rectLienzo, hud)).toBe(true);
  }

  // Mientras la mecha está encendida (cuentaAtrasAdherencia no nulo),
  // comprueba en varios fotogramas reales que la posición publicada sigue a
  // menos de 2px de mundo del punto de adherencia resuelto -- un único
  // evaluate() por muestra para que "sigue en curso" y "posición" sean del
  // mismo instante (mismo hueco que gra-3, imp/proy-5).
  let capturada = false;
  let muestrasConContador = 0;
  for (let i = 0; i < 200; i++) {
    const instante = await page.evaluate((n) => {
      const enCurso = window.__debug.animacionEnCurso === true && (window.__debug.numeroTurno ?? 0) === n;
      if (!enCurso) return { enCurso: false as const, contador: null };
      return { enCurso: true as const, contador: window.__debug.cuentaAtrasAdherencia ?? null };
    }, numeroTurnoAntes);
    if (!instante.enCurso) break;
    if (instante.contador) {
      muestrasConContador++;
      expect(Math.abs(instante.contador.x - impactoResuelto.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(instante.contador.y - impactoResuelto.y)).toBeLessThanOrEqual(2);
      if (!capturada) {
        await page.screenshot({ path: "capturas/arma-mina-adherente-18-cuenta-atras.png" });
        capturada = true;
      }
    }
    await page.waitForTimeout(15);
  }
  expect(muestrasConContador).toBeGreaterThan(0);

  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes);

  // Mismo razonamiento que gra-2: la última escritura real antes de
  // limpiarse (null) no puede quedarse a medias -- tiene que haber llegado a
  // 0 (o, como mucho, el redondeo de un paso fijo de margen).
  const escrituras = await page.evaluate(
    () => (window as unknown as { __minEscrituras: ({ segundosRestantes: number } | null)[] }).__minEscrituras,
  );
  const ultimaNoNula = [...escrituras].reverse().find((e) => e !== null);
  expect(ultimaNoNula).toBeDefined();
  expect(ultimaNoNula!.segundosRestantes).toBeLessThanOrEqual(1);
  expect(escrituras[escrituras.length - 1]).toBeNull();
});
