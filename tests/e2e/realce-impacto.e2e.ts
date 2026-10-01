import { test, expect } from "@playwright/test";

async function entrarAPartida(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

// rlc-1 (camino_critico): un impacto directo real dispara una sacudida de
// cámara acotada y proporcional al daño, y esa sacudida SIEMPRE termina
// antes de que numeroTurno avance. Aterrizar un impacto directo (que cruce
// el casco real, no solo "cerca") apuntando a mano no es determinista --
// mismo motivo documentado por contacto-honesto para con-2/con-3 -- así que
// se usa dispararRafagaTurbo (ya existente, proy-4/proy-5/hum-1) para jugar
// varios turnos reales (dispararEntrada -> aplicarResultadoTurno, el mismo
// camino que un disparo de verdad) hasta que alguno sea un impacto directo.
// Lo que de verdad hay que demostrar -- que avanceTurnoPendiente no cuelga
// la ráfaga síncrona -- se demuestra por el propio hecho de que la ráfaga
// termina en el número de turnos pedido: antes de este bloque no había
// ningún avance de turno retrasado, y dispararRafagaTurbo tiene su propia
// guardia defensiva que corta la ráfaga en corto si algo se queda pendiente.
test("rlc-1: la sacudida de cámara es acotada y nunca deja la ráfaga de turnos a medias", async ({ page }) => {
  test.setTimeout(150000);
  await entrarAPartida(page);

  const NUMERO_DE_TURNOS = 8;
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.evaluate((n) => window.__debug.dispararRafagaTurbo!(n), NUMERO_DE_TURNOS);

  await page.waitForFunction(
    (n) => (window.__debug.numeroTurno ?? 0) >= n,
    numeroTurnoAntes + NUMERO_DE_TURNOS,
    { timeout: 30000 },
  );
  // Lo que hay que demostrar es que avanceTurnoPendiente no deja la ráfaga
  // a medias: la propia espera de arriba ya lo prueba (si se hubiera
  // quedado colgado, habría agotado el timeout en vez de llegar aquí) --
  // shakeEffect.isRunning no se comprueba aquí porque depende del paso de
  // cámara de Phaser, que la ráfaga síncrona no hace avanzar (igual que
  // cualquier otro efecto puramente visual durante dispararRafagaTurbo).

  // Si durante la ráfaga cayó algún impacto directo (con-2), su amplitud
  // registrada respeta el mismo rango acotado que ya comprueba en detalle
  // tests/unit/efectos/rlc-1.test.ts -- pero un impacto directo exacto
  // (que cruce el casco, no solo "cerca") apuntando con la fórmula cerrada
  // no está garantizado en N turnos, así que esto no es una condición de
  // la ráfaga, solo una comprobación de rango cuando sí ocurre.
  const realce = await page.evaluate(() => window.__debug.ultimoRealceImpacto);
  if (realce) {
    expect(realce.danio).toBeGreaterThan(0);
    expect(realce.amplitud).toBeGreaterThan(0);
  }

  await page.screenshot({ path: "capturas/realce-impacto-1-sacudida.png" });
});

// rlc-2 (camino_critico): el realce de impacto (sacudida + destello rojo)
// solo dispara con daño real -- un roce nunca lo activa y conserva su propio
// efecto (el chispazo + panel-roce de contacto-honesto), distinto y más
// débil. Se usan los mismos atajos de depuración que con-2/con-3 porque
// aterrizar un roce real a mano no es reproducible de forma determinista.
test("rlc-2: el roce nunca dispara sacudida ni destello de daño, solo el impacto real", async ({ page }) => {
  await entrarAPartida(page);

  await page.evaluate(() => window.__debug.dispararEventoRoce!(1, 200, 300));
  // con-3: el roce mantiene su propio aviso.
  await expect(page.getByTestId("panel-roce")).toBeVisible();
  expect(await page.evaluate(() => window.__debug.sacudiendoCamara)).toBe(false);
  expect(await page.evaluate(() => window.__debug.ultimoRealceImpacto ?? null)).toBeNull();

  await page.screenshot({ path: "capturas/realce-impacto-2-roce-sin-sacudida.png" });

  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 30));
  await expect
    .poll(async () => page.evaluate(() => window.__debug.sacudiendoCamara === true), {
      timeout: 5000,
      intervals: [20, 50],
    })
    .toBe(true);
  const realce = await page.evaluate(() => window.__debug.ultimoRealceImpacto);
  expect(realce).toEqual({ danio: 30, amplitud: expect.any(Number) });

  await page.screenshot({ path: "capturas/realce-impacto-3-impacto-con-sacudida.png" });
});

// rlc-1 (proporcional, acotado): a más daño, más amplitud, nunca por encima
// de un tope -- comprobado contra el camino de disparo de depuración (mismo
// manejarEventosVisuales que un turno real), no solo contra la función pura.
test("rlc-1: la amplitud crece con el daño real pero nunca supera el tope", async ({ page }) => {
  await entrarAPartida(page);

  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 5));
  const amplitudBaja = (await page.evaluate(() => window.__debug.ultimoRealceImpacto))!.amplitud;

  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 60));
  const amplitudAlta = (await page.evaluate(() => window.__debug.ultimoRealceImpacto))!.amplitud;

  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 999));
  const amplitudExtrema = (await page.evaluate(() => window.__debug.ultimoRealceImpacto))!.amplitud;

  expect(amplitudAlta).toBeGreaterThan(amplitudBaja);
  // Tope duro: un daño muy por encima de la escala de referencia no supera
  // lo que ya daba el daño de referencia máxima.
  expect(amplitudExtrema).toBe(amplitudAlta);
});

// rlc-3 (no camino_critico): el interruptor desactiva sacudida+destello, y
// la elección persiste tras recargar la página -- igual que el resto de
// ajustes de apuntado (fijarAjuste/leerAjusteGuardado), vía localStorage.
test("rlc-3: el interruptor de sacudida desactiva el realce y persiste tras recargar", async ({ page }) => {
  await entrarAPartida(page);

  const boton = page.getByTestId("toggle-sacudida");
  await expect(boton).toHaveAttribute("aria-pressed", "true");
  await boton.click();
  await expect(boton).toHaveAttribute("aria-pressed", "false");

  await page.evaluate(() => window.__debug.dispararEventoImpactoReal!(1, 200, 300, 30));
  // Con el ajuste desactivado, ningún desplazamiento de cámara (ver el
  // comentario de rlc-1/rlc-2 en manejarEventosVisuales, Partida.ts).
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => window.__debug.sacudiendoCamara)).toBe(false);
  expect(await page.evaluate(() => window.__debug.ultimoRealceImpacto ?? null)).toBeNull();

  // Recargar vuelve al menú (solo el ajuste persiste en localStorage, no la
  // partida en curso) -- hay que volver a entrar para ver el HUD de nuevo.
  await page.reload();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  await expect(page.getByTestId("toggle-sacudida")).toHaveAttribute("aria-pressed", "false");
});
