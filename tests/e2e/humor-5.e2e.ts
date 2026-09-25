import { test, expect } from "@playwright/test";

// Deben coincidir con src/juego/control/apuntado.ts (misma convención que
// control-1: el e2e no importa del código fuente, así que estas constantes
// viven duplicadas a propósito).
const GANANCIA_ANGULO_GRADOS = 120;
const GANANCIA_POTENCIA = 150;
const ANGULO_INICIAL_GRADOS = 45;
const POTENCIA_INICIAL = 50;

// humor-5: Phaser decide pausar/reanudar su propio bucle mirando
// document.hidden en el evento "visibilitychange" (VisibilityHandler,
// confirmado leyendo el fuente de Phaser) -- sobreescribirlo a mano y
// disparar el evento simula un cambio de pestaña real de forma determinista,
// sin depender de que el navegador de CI trate una segunda pestaña como
// oculta a la primera (comportamiento no garantizado en Chromium headless).
async function simularCambioDeVisibilidad(page: import("@playwright/test").Page, oculta: boolean): Promise<void> {
  await page.evaluate((valor) => {
    Object.defineProperty(document, "hidden", { value: valor, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, oculta);
}

// Dispara el mismo tiro largo (mapa, ángulo y potencia fijos) en una página
// nueva y devuelve el punto de impacto real. Se reutiliza tal cual para la
// ejecución de referencia (sin ocultar) y, con `ocultarEnPlenoVuelo`, para la
// que sí oculta la pestaña a mitad de trayecto -- el mapa y la semilla de
// partida son fijos (?mapa=calma-de-los-restos), así que dos ejecuciones con
// la misma entrada deben acabar en el mismo píxel si ocultar la pestaña no
// teletransporta ni desincroniza nada.
async function dispararTiroLargo(
  page: import("@playwright/test").Page,
  ocultarEnPlenoVuelo: boolean,
): Promise<{ x: number; y: number }> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  // El tutorial solo se enseña una vez por origen (localStorage) -- en la
  // segunda pasada de esta misma prueba (la que sí oculta la pestaña,
  // reutilizando la página tras un nuevo goto) ya no aparece, así que no se
  // puede depender de este clic como EL gesto que desbloquea el audio.
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);

  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();
  const deltaY = -(solucion!.anguloGrados - ANGULO_INICIAL_GRADOS) / GANANCIA_ANGULO_GRADOS;
  const deltaX = (solucion!.potencia - POTENCIA_INICIAL) / GANANCIA_POTENCIA;
  const inicio = { x: 195, y: 760 };
  const fin = { x: inicio.x + deltaX * 390, y: inicio.y + deltaY * 844 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  // El pointerdown que arranca el arrastre de apuntado es EL gesto real que
  // desbloquea el audio (ver desbloquearAudio en motor.ts) -- el único que
  // está garantizado en las dos pasadas de esta prueba, a diferencia del
  // clic en ayuda-cerrar.
  await page.waitForFunction(() => window.__debug.estadoAudio!() === "en-marcha");
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.animacionEnCurso === true);

  if (ocultarEnPlenoVuelo) {
    await simularCambioDeVisibilidad(page, true);
    await page.waitForFunction(() => window.__debug.estadoAudio!() === "suspendido");

    const animacionEnCursoOculta = await page.evaluate(() => window.__debug.animacionEnCurso);
    // El vuelo seguía en curso cuando se ocultó: si ya hubiera acabado, la
    // pausa no estaría probando nada de este criterio.
    expect(animacionEnCursoOculta).toBe(true);

    await page.waitForTimeout(1500);

    await simularCambioDeVisibilidad(page, false);
    await page.waitForFunction(() => window.__debug.estadoAudio!() === "en-marcha");
  }

  // Tiro casi vertical a potencia máxima (ver más arriba): ya era lento con
  // renderizado por hardware, y SwiftShader (sin GPU real en CI/VPS, hueco ya
  // documentado en render-3) lo alarga más todavía -- el margen tiene que
  // cubrir el peor caso real, no el optimista.
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 120000 });
  const impacto = await page.evaluate(() => window.__debug.ultimoDisparo!.impactoReal!);
  expect(Number.isFinite(impacto.x)).toBe(true);
  expect(Number.isFinite(impacto.y)).toBe(true);
  return impacto;
}

test("humor-5: ocultar la pestaña en pleno vuelo pausa el audio y no rompe el impacto al volver", async ({ page }) => {
  test.setTimeout(300000);

  // Referencia: el mismo tiro, sin ocultar la pestaña. El mapa y la solución
  // balística son fijos, así que este punto de impacto es lo que el criterio
  // llama "la ejecución sin ocultar" -- se reutiliza la misma página (en vez
  // de un segundo contexto/pestaña concurrente) para no tener dos juegos con
  // WebGL por software vivos a la vez, que en esta máquina agota memoria y
  // se lleva el servidor de desarrollo por delante.
  const impactoReferencia = await dispararTiroLargo(page, false);

  const impacto = await dispararTiroLargo(page, true);

  expect(impacto.x).toBeCloseTo(impactoReferencia.x, 1);
  expect(impacto.y).toBeCloseTo(impactoReferencia.y, 1);
});
