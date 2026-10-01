import { test, expect } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";
import { escalaDeDanio } from "@/juego/efectos/ExplosionPorCapas";

// Mismo helper que imp-12/pyl-3: cada comprobación se hace justo cuando
// numeroTurno avanza en +1 tras "disparar", antes de que la respuesta de la
// máquina resuelva su propio turno y sobrescriba el estado con su propio
// desenlace.
async function arrastrarHasta(
  page: import("@playwright/test").Page,
  anguloObjetivo: number,
  potenciaObjetivo: number,
): Promise<void> {
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

// exl-1 (camino_critico): un impacto con daño real dispara las cinco capas
// de la explosión -- se distinguen al menos tres capas activas en instantes
// distintos (destello, onda, escombros), y su extensión es proporcional al
// daño real, no fija. La comprobación de "instantes distintos" usa
// fasesActivasExplosion, una función PURA (no un sleep ni una ventana de
// tiempo real, issue #151): es la misma función que decide qué dibuja el
// juego, así que preguntarle "¿qué toca a los X ms?" es tan determinista
// como el propio efecto.
test("exl-1: el impacto con daño dispara destello, onda y escombros en instantes distintos, con extensión proporcional al daño", async ({
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

  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion).not.toBeNull();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await arrastrarHasta(page, solucion!.anguloGrados, solucion!.potencia);
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, numeroTurnoAntes, { timeout: 120000 });

  expect(await page.evaluate(() => window.__debug.ultimoTipoExplosion)).toBe("danio");

  const datos = await page.evaluate(() => window.__debug.ultimaExplosionPorCapas);
  expect(datos).toBeTruthy();
  expect(datos!.danio).toBeGreaterThan(0);

  await page.screenshot({ path: "capturas/explosiones-por-capas-23-exl1-impacto.png" });

  // "en instantes distintos": a 0 ms solo destello/onda tocan, a 300 ms ya
  // no toca el destello pero sí onda y escombros, a 700 ms solo escombros.
  const fasesEn0 = await page.evaluate(() => window.__debug.fasesActivasExplosion!(0));
  const fasesEn300 = await page.evaluate(() => window.__debug.fasesActivasExplosion!(300));
  const fasesEn700 = await page.evaluate(() => window.__debug.fasesActivasExplosion!(700));

  expect(fasesEn0).toContain("destello");
  expect(fasesEn300).not.toContain("destello");
  expect(fasesEn300).toContain("onda");
  expect(fasesEn300).toContain("escombros");
  expect(fasesEn700).not.toContain("destello");
  expect(fasesEn700).not.toContain("onda");
  expect(fasesEn700).toContain("escombros");

  // Proporcional al daño real, no fija: la escala registrada en el impacto
  // real coincide con la misma función pura aplicada al daño que el núcleo
  // resolvió -- y esa función, por construcción, da números distintos para
  // daños distintos (comprobado también en el unitario explosionPorCapas).
  expect(datos!.escala).toBeCloseTo(escalaDeDanio(datos!.danio), 6);
  expect(escalaDeDanio(60)).toBeGreaterThan(escalaDeDanio(4));
});

// exl-4 (camino_critico): las explosiones encadenadas de un arma de
// submuniciones (cinco detonaciones del mismo disparo) no dejan la partida
// bloqueada -- el turno avanza y el resultado se declara dentro del límite
// de tiempo de un turno real.
test("exl-4: un disparo de submuniciones con varias explosiones encadenadas cierra el turno", async ({ page }) => {
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
  await page.getByTestId("arma-racimo-de-tuppers").click();
  await page.waitForFunction(() => window.__debug.control!.ajuste.armaId === "racimo-de-tuppers");
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);

  // Mismo arco bajo-y-potente que proy-5/pyl-3: se mantiene dentro del campo
  // de batalla y garantiza impacto contra terreno o planeta, que es lo que
  // hace saltar las cinco submuniciones.
  await arrastrarHasta(page, 18, 90);

  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();

  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes, { timeout: 60000 });
  // No comprobar animacionEnCurso justo aquí: si la partida sigue, la
  // máquina dispara su propio turno de forma SÍNCRONA dentro del mismo
  // callback que cierra el del jugador (ver dispararTurnoIA en Partida.ts),
  // así que "false" solo existe durante un instante que este proceso nunca
  // llega a observar -- comprobarlo de inmediato es una carrera, no un
  // bloqueo real. Lo que exl-4 exige es que la animación TERMINE por
  // resolverse sola (la del jugador, y si la hay, la de respuesta de la
  // máquina), así que se espera a que vuelva a false con polling y
  // timeout generoso (issue #151), nunca con un sleep fijo.
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 60000 });
  await expect(page.getByTestId("resultado-turno")).toBeVisible();
  const texto = (await page.getByTestId("resultado-turno").textContent())!.trim();
  expect(texto.length).toBeGreaterThan(0);
});
