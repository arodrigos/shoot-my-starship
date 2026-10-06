import { test, expect } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

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

  await expect(page.getByTestId("toggle-silenciado")).toHaveAttribute("aria-pressed", "true");
});

// snd-2 (no camino_critico): impacto y roce quedan registrados con timbres
// (ids) distintos en el historial de depuración -- se comprueba leyendo el
// registro, no escuchando audio real, para que el test no dependa de que el
// Chromium headless del CI reproduzca sonido de verdad (mismo principio que
// humor-6 para la reacción visual).
test("snd-2: impacto y roce quedan registrados con sonidos distintos", async ({ page }) => {
  await entrarAPartida(page);
  await page.getByTestId("toggle-silenciado").click();

  await page.evaluate(() => window.__debug.dispararEventoRoce!(1, 200, 300));
  const historialTrasRoce = await page.evaluate(() => window.__debug.audio!().historial);
  expect(historialTrasRoce[historialTrasRoce.length - 1]?.id).toBe("roce");

  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 30));
  const historialTrasImpacto = await page.evaluate(() => window.__debug.audio!().historial);
  expect(historialTrasImpacto[historialTrasImpacto.length - 1]?.id).toBe("impacto");
});

// snd-2 (no camino_critico): las dos armas de cuenta atrás suenan con
// timbres distintos entre sí -- se fuerza una mecha corta y determinista
// (mismo hook forzarFusibleMechaPasos/forzarFusibleAdherenciaPasos que
// gra-2/min-2, ya que ningún mundo jugable deja que el vuelo natural supere
// el presupuesto de pasos) y se comprueba el historial durante el vuelo en
// curso, sin esperar a que la IA resuelva su turno de respuesta.
test("snd-2: la mecha y la mina suenan con tic-tac distintos entre sí", async ({ page }) => {
  test.setTimeout(120000);
  await entrarAPartida(page);
  await page.getByTestId("toggle-silenciado").click();

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("arma-granada-de-espoleta").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "granada-de-espoleta");
  await page.evaluate(() => window.__debug.forzarFusibleMechaPasos!(100));
  await apuntar(page, 45, 80);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  const numeroTurnoMecha = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    (n) => window.__debug.animacionEnCurso === true && (window.__debug.numeroTurno ?? 0) === n,
    numeroTurnoMecha,
  );

  await expect
    .poll(
      async () =>
        page.evaluate(() => window.__debug.audio!().historial.some((e) => e.id === "tictac-mecha")),
      { timeout: 10000, intervals: [50, 100] },
    )
    .toBe(true);

  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoMecha);
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("arma-gancho-pegajoso").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "gancho-pegajoso");
  await page.evaluate(() => window.__debug.forzarFusibleAdherenciaPasos!(100));
  await apuntar(page, 30, 50);

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
