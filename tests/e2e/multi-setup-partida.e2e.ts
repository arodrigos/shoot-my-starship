import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { arrastrarBarraHasta } from "./utilesControl";

// multi-setup-partida: se juega por la pantalla de inicio real (nada de
// atajos de URL para los jugadores), sobre un mapa de suelo plano sembrado
// (deriva 0) donde la solución balística exacta de window.__debug existe y
// el apuntado es determinista.
const MAPA_SEMBRADO = "calma-de-los-restos";
const MAXIMO_TURNOS = 40;
const NOMBRE_CON_ETIQUETAS = "<b>ñ</b>";
const NOMBRE_LARGO = "0123456789ABCDEFXYZ";

async function esperarPartida(page: Page): Promise<void> {
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

// Un turno humano real: apunta con la solución exacta contra el objetivo que
// la escena elige y dispara. Devuelve el id de quien tenía el turno.
async function dispararTurnoHumano(page: Page): Promise<number> {
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
  const { turno, numeroTurno } = await page.evaluate(() => ({ turno: window.__debug.turno!, numeroTurno: window.__debug.numeroTurno! }));
  const solucion = await page.evaluate(() => window.__debug.solucionBalisticaJugador!());
  expect(solucion, `turno ${numeroTurno}: debe existir solución exacta en un mapa de deriva 0`).not.toBeNull();
  const fraccionAngulo = (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
  const fraccionPotencia = (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
  await arrastrarBarraHasta(page, "barra-angulo", fraccionAngulo);
  await arrastrarBarraHasta(page, "barra-potencia", fraccionPotencia);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    (anterior) => window.__debug.parteDeGuerra !== null || (window.__debug.numeroTurno ?? 0) > anterior,
    numeroTurno,
    { timeout: 30000 },
  );
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false, undefined, { timeout: 30000 });
  return turno;
}

test("multi-setup-partida-1/3/5/6/7: configurar 4 humanos a 360x640 y jugar hasta el ganador, sin red y con nombres literales", async ({ page }) => {
  test.setTimeout(420000);
  const peticionesAjenas: string[] = [];
  const origen = new URL(page.url() === "about:blank" ? "http://127.0.0.1:3000" : page.url()).origin;
  page.on("request", (peticion) => {
    const url = peticion.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    if (new URL(url).origin !== origen) peticionesAjenas.push(url);
  });
  let dialogos = 0;
  page.on("dialog", async (dialogo) => {
    dialogos += 1;
    await dialogo.dismiss();
  });

  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);

  // multi-setup-partida-6: la ayuda del modo está antes de empezar.
  await expect(page.getByTestId("ayuda-multijugador")).toContainText("mismo dispositivo");
  await expect(page.getByTestId("ayuda-multijugador")).toContainText("turnos");

  await page.getByTestId("humanos-4").click();
  // Con 4 humanos no cabe ningún rival de IA.
  await expect(page.getByTestId("ias-0")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("ias-1")).toBeDisabled();
  await page.getByTestId("nombre-jugador-0").pressSequentially(NOMBRE_CON_ETIQUETAS);
  await page.getByTestId("nombre-jugador-1").pressSequentially(NOMBRE_LARGO);
  await page.getByTestId("nombre-jugador-2").pressSequentially("Ana");
  await page.getByTestId("nombre-jugador-3").pressSequentially("Luis");
  // multi-setup-partida-5: el campo ya acota a 16 caracteres al escribir.
  await expect(page.getByTestId("nombre-jugador-1")).toHaveValue(NOMBRE_LARGO.slice(0, 16));

  // El tamaño de objetivo táctil de la pantalla de configuración.
  const axe = await new AxeBuilder({ page }).withRules(["target-size"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: "test-results/multi-setup-partida/multi-setup-partida-01-configuracion-360x640.png", fullPage: true });

  await page.getByTestId("boton-jugar").click();
  await esperarPartida(page);

  const controladores = await page.evaluate(() => window.__debug.controladores!);
  expect(controladores.map((c) => c.nombre)).toEqual([NOMBRE_CON_ETIQUETAS, NOMBRE_LARGO.slice(0, 16), "Ana", "Luis"]);
  expect(controladores.every((c) => c.tipo === "humano")).toBe(true);
  const naves = await page.evaluate(() => window.__debug.naves!);
  expect(naves).toHaveLength(4);
  await page.screenshot({ path: "test-results/multi-setup-partida/multi-setup-partida-02-cuatro-naves-360x640.png" });

  // multi-setup-partida-3: en cada uno de los cuatro turnos, el canal de
  // estado marca como activa exactamente la nave que el núcleo dice.
  const turnosJugados: number[] = [];
  for (let asiento = 0; asiento < 4; asiento++) {
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
    const turnoNucleo = await page.evaluate(() => window.__debug.turno!);
    expect(turnoNucleo).toBe(asiento);
    for (let id = 0; id < 4; id++) {
      const barra = page.getByTestId(`integridad-nave-${id}`);
      if (id === turnoNucleo) await expect(barra).toHaveAttribute("aria-current", "true");
      else await expect(barra).not.toHaveAttribute("aria-current", "true");
    }
    // multi-setup-partida-5: el nombre con etiquetas se pinta como texto.
    if (asiento === 0) {
      await expect(page.getByTestId("integridad-nave-0")).toContainText(NOMBRE_CON_ETIQUETAS);
      expect(await page.locator('[data-testid="integridad-nave-0"] b').count()).toBe(0);
    }
    turnosJugados.push(await dispararTurnoHumano(page));
    if (asiento === 1) {
      await page.screenshot({ path: "test-results/multi-setup-partida/multi-setup-partida-03-turno-2-360x640.png" });
    }
  }
  expect(turnosJugados).toEqual([0, 1, 2, 3]);

  // Para no gastar ~15 turnos de 20 de daño, se deja a las rivales de la nave
  // 0 a un solo impacto: lo que sigue sigue siendo disparo real, eliminación
  // real y fin de partida real; solo se acorta el camino hasta ahí.
  await page.evaluate(() => {
    for (const id of [1, 2, 3]) window.__debug.forzarIntegridad!(id, 18);
  });

  // multi-setup-partida-2/4: se juega hasta que solo queda una nave y nadie
  // eliminado vuelve a recibir turno.
  const eliminadasVistas = new Set<number>();
  for (let i = 0; i < MAXIMO_TURNOS; i++) {
    const estado = await page.evaluate(() => ({
      parte: window.__debug.parteDeGuerra,
      eliminadas: window.__debug.eliminadas ?? [],
      turno: window.__debug.turno!,
    }));
    const nuevas = estado.eliminadas.filter((id) => !eliminadasVistas.has(id));
    for (const id of estado.eliminadas) eliminadasVistas.add(id);
    if (nuevas.length > 0 && estado.parte === null) {
      // multi-setup-partida-4: el anuncio sale con el nombre de quien cayó.
      for (const id of nuevas) await expect(page.getByTestId("resultado-turno")).toContainText(`${controladores[id].nombre} queda eliminada`);
    }
    if (estado.parte !== null) break;
    expect(eliminadasVistas.has(estado.turno), `la nave eliminada ${estado.turno} recibió turno`).toBe(false);
    await dispararTurnoHumano(page);
  }

  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
  const ganadorId = await page.evaluate(() => window.__debug.ganador);
  expect(ganadorId).not.toBeNull();
  const nombreGanador = controladores[ganadorId as number].nombre;
  await expect(page.getByTestId("ganador-nombre")).toHaveText(`Gana ${nombreGanador}`);
  const vivas = await page.evaluate(() => window.__debug.naves!.filter((nave) => nave.integridad > 0).map((nave) => nave.id));
  expect(vivas).toEqual([ganadorId]);
  // multi-setup-partida-4: la eliminación se anunció con el nombre de quien cayó.
  const eliminadas = await page.evaluate(() => window.__debug.eliminadas!);
  expect(eliminadas.length).toBe(3);
  await page.screenshot({ path: "test-results/multi-setup-partida/multi-setup-partida-04-ganador-360x640.png" });

  // multi-setup-partida-5/7: nada se ejecutó y nada salió del origen.
  expect(dialogos).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
  expect(peticionesAjenas).toEqual([]);
});

test("multi-setup-partida-6: 2 humanos y 2 rivales de IA se juegan hasta el final", async ({ page }) => {
  test.setTimeout(360000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("humanos-2").click();
  await page.getByTestId("ias-2").click();
  await expect(page.getByTestId("resumen-asientos")).toContainText("4 naves");
  await page.getByTestId("boton-jugar").click();
  await esperarPartida(page);

  const controladores = await page.evaluate(() => window.__debug.controladores!);
  expect(controladores.map((c) => c.tipo)).toEqual(["humano", "humano", "ia", "ia"]);

  // Las dos IA y el humano 1 a un solo impacto: el humano 0 gana o pierde
  // pero la partida termina en pocos turnos con las dos IA jugando de verdad.
  await page.evaluate(() => {
    for (const id of [1, 2, 3]) window.__debug.forzarIntegridad!(id, 18);
  });

  for (let i = 0; i < MAXIMO_TURNOS; i++) {
    const cerrada = await page.waitForFunction(
      () => window.__debug.parteDeGuerra !== null || window.__debug.control!.puedeDisparar === true,
      undefined,
      { timeout: 60000 },
    );
    await cerrada.dispose();
    if ((await page.evaluate(() => window.__debug.parteDeGuerra)) !== null) break;
    await dispararTurnoHumano(page);
  }
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
  await expect(page.getByTestId("ganador-nombre")).toContainText(/^(Gana |Empate)/);
});
