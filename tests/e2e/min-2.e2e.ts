import { test, expect } from "@playwright/test";
import { createCanvas, loadImage } from "canvas";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// min-2 (hallazgo del gatekeeper): el guardia anterior solo comprobaba el
// DATO publicado en window.__debug, nunca lo que de verdad se pintaba en el
// lienzo -- así coló un contador comprimido a ~0,75px CSS (el bug de
// ContadorAdherencia.ts que invertía displayScale.x). Esta comprobación
// decodifica el PNG real de la captura con el paquete "canvas" (ya
// dependencia del repo, nunca del lado del navegador: no toca el guardia
// terreno-6/comprobar-sin-lectura-canvas.mjs, que solo vigila src/juego y
// src/sim) y mide en PÍXELES DE PANTALLA el bloque de color de fondo del
// contador (#2a0a0a) alrededor de su punto de ancla, para que un contador
// invisible o microscópico vuelva a hacer fallar el test aunque el dato
// publicado sea correcto.
const FONDO_CONTADOR_RGB = { r: 0x2a, g: 0x0a, b: 0x0a };
const TOLERANCIA_COLOR = 40;
const ALTO_MINIMO_LEGIBLE_CSS_PX = 12;

async function medirBloqueDeFondo(
  buffer: Buffer,
  ventana: { left: number; top: number; right: number; bottom: number },
): Promise<{ ancho: number; alto: number; muestras: number }> {
  const imagen = await loadImage(buffer);
  const lienzo = createCanvas(imagen.width, imagen.height);
  const contexto = lienzo.getContext("2d");
  contexto.drawImage(imagen, 0, 0);

  const left = Math.max(0, Math.floor(ventana.left));
  const top = Math.max(0, Math.floor(ventana.top));
  const right = Math.min(imagen.width, Math.ceil(ventana.right));
  const bottom = Math.min(imagen.height, Math.ceil(ventana.bottom));
  const { data } = contexto.getImageData(left, top, right - left, bottom - top);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let muestras = 0;
  const ancho = right - left;
  for (let y = 0; y < bottom - top; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const distancia = Math.abs(r - FONDO_CONTADOR_RGB.r) + Math.abs(g - FONDO_CONTADOR_RGB.g) + Math.abs(b - FONDO_CONTADOR_RGB.b);
      if (distancia <= TOLERANCIA_COLOR) {
        muestras++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (muestras === 0) {
    return { ancho: 0, alto: 0, muestras: 0 };
  }
  return { ancho: maxX - minX + 1, alto: maxY - minY + 1, muestras };
}

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

  // DESVIACIÓN (encuadre-movil): el ángulo/potencia fijos (30/50) se
  // calibraron a mano contra el mundo 1920x1080 de antes de este bloque --
  // con encuadre-movil el mundo cambia de tamaño con el contenedor real, así
  // que ese punto de adherencia ya no cae cerca de la nave rival ni dentro
  // del mundo en todos los dispositivos. Mismo patrón que min-3/gra-3: se
  // usa la solución balística exacta del propio motor (independiente del
  // tamaño de mundo) en vez de un ángulo/potencia adivinado.
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();
  const fraccionAngulo = (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
  const fraccionPotencia = (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
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
        const buffer = await page.screenshot({ path: "capturas/arma-mina-adherente-18-cuenta-atras.png" });
        capturada = true;

        // Ventana de búsqueda en px de PANTALLA alrededor del punto de
        // ancla (world -> screen vía el rectángulo real del lienzo, no un
        // valor de cámara supuesto): generosa hacia arriba porque el texto
        // se dibuja DESPLAZAMIENTO_VERTICAL_CSS_PX por encima del ancla.
        // DESVIACIÓN (encuadre-movil): se lee window.__debug.mundo en vez
        // de importar MUNDO_ANCHO/MUNDO_ALTO -- ese import es del lado
        // Node del test y nunca ve el ajuste que hace configurarTamanoMundo
        // en el navegador.
        const mundo = (await page.evaluate(() => window.__debug.mundo))!;
        const escalaX = (rectLienzo.right - rectLienzo.left) / mundo.ancho;
        const escalaY = (rectLienzo.bottom - rectLienzo.top) / mundo.alto;
        const anclaScreenX = rectLienzo.left + instante.contador.x * escalaX;
        const anclaScreenY = rectLienzo.top + instante.contador.y * escalaY;
        const bloque = await medirBloqueDeFondo(buffer, {
          left: anclaScreenX - 40,
          right: anclaScreenX + 40,
          top: anclaScreenY - 70,
          bottom: anclaScreenY + 10,
        });

        // min-2 (hallazgo del gatekeeper): esto es justo lo que el guardia
        // anterior no comprobaba -- antes del arreglo de ContadorAdherencia
        // (compensacionEscala invertida) este bloque medía ~1px de alto.
        expect(bloque.muestras).toBeGreaterThan(0);
        expect(bloque.alto).toBeGreaterThanOrEqual(ALTO_MINIMO_LEGIBLE_CSS_PX);
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
