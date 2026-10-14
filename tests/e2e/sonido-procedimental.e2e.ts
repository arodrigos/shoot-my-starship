import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta, abrirAjustes, pulsarAjuste } from "./utilesControl";

async function entrarAPartida(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  // banda-sonora: la música viene activada y crearía el contexto con "Jugar";
  // estos tests miden solo el camino de los efectos.
  await page.addInitScript(() => localStorage.setItem("banda-sonora:activada", "0"));
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

async function apuntar(page: import("@playwright/test").Page, anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
  const fraccionAngulo = (anguloObjetivo - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
  const fraccionPotencia = (potenciaObjetivo - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
  await arrastrarBarraHasta(page, "barra-angulo", fraccionAngulo);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionPotencia);
}

// snd-1 (camino_critico): "el sonido nunca se impone" -- nada crea un
// AudioContext por el simple hecho de entrar a jugar (ni el clic de
// "Jugar" en PantallaInicio ni el pointerdown de seguridad de Partida.ts),
// y el interruptor que SÍ lo hace es, él mismo, un objetivo táctil de al
// menos 44x44px (WCAG 2.2 SC 2.5.5, mismo umbral que esp-4), siempre
// visible en la misma fila fija que toggle-sacudida.
test("snd-1: no existe AudioContext hasta el gesto explícito, y el interruptor es un objetivo táctil de 44x44 o más", async ({ page }) => {
  await entrarAPartida(page);

  expect(await page.evaluate(() => window.__debug.estadoAudio!())).toBe("sin-inicializar");

  await abrirAjustes(page);
  const boton = page.getByTestId("toggle-silenciado");
  await expect(boton).toBeVisible();
  await expect(boton).toHaveAttribute("aria-pressed", "false");

  const caja = (await boton.boundingBox())!;
  expect(caja.width).toBeGreaterThanOrEqual(44);
  expect(caja.height).toBeGreaterThanOrEqual(44);
});

// snd-1 (camino_critico): activar el sonido es el propio gesto que
// desbloquea el AudioContext (alternarSonido llama a desbloquearAudio en el
// mismo clic), y la elección persiste tras recargar -- mismo patrón de
// localStorage que rlc-3 para la sacudida.
test("snd-1: activar el sonido crea el AudioContext y persiste tras recargar", async ({ page }) => {
  await entrarAPartida(page);

  await abrirAjustes(page);
  const boton = page.getByTestId("toggle-silenciado");
  await boton.click();
  await expect(boton).toHaveAttribute("aria-pressed", "true");

  // El propio clic es el gesto: resume() es asíncrono, así que se sondea el
  // estado real (nunca un sleep fijo, issue #151) hasta que deje de estar
  // "sin-inicializar".
  await expect
    .poll(async () => page.evaluate(() => window.__debug.estadoAudio!()), { timeout: 5000, intervals: [20, 50] })
    .not.toBe("sin-inicializar");

  await page.reload();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await abrirAjustes(page);
  await expect(page.getByTestId("toggle-silenciado")).toHaveAttribute("aria-pressed", "true");
});

// snd-2 (no camino_critico): la mina suena con su propio tic-tac -- se fuerza
// una mecha corta y determinista (forzarFusibleAdherenciaPasos, como min-2,
// ya que ningún mundo jugable deja que el vuelo natural supere el
// presupuesto de pasos) y se comprueba el historial durante el vuelo en
// curso. armas-recorte retiró la Granada, así que ya no hay tic-tac de mecha
// con el que contrastarlo.
test("snd-2: la mina suena con su tic-tac", async ({ page }) => {
  test.setTimeout(120000);
  await entrarAPartida(page);
  await pulsarAjuste(page, "toggle-silenciado");

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("arma-gancho-pegajoso").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "gancho-pegajoso");
  await page.evaluate(() => window.__debug.forzarFusibleAdherenciaPasos!(100));
  // salida-pantalla: un 30°/50 fijo ya sale del encuadre y se pierde sin
  // pegarse, así que no hay mina que cuente; la solución balística del motor
  // da un tiro que sí llega a la nave rival.
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();
  await apuntar(page, solucion!.anguloGrados, solucion!.potencia);

  const numeroTurnoMina = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    (n) => window.__debug.animacionEnCurso === true && (window.__debug.numeroTurno ?? 0) === n,
    numeroTurnoMina,
  );

  await expect
    .poll(
      async () => page.evaluate(() => window.__debug.audio!().historial.some((e) => e.id === "tictac-mina")),
      { timeout: 10000, intervals: [50, 100] },
    )
    .toBe(true);
});
