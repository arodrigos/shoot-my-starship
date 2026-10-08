import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// hud-canales: HUD partido en canal de estado (permanente) y canal pasivo
// (la broma, efímera) -- ver diseño del bloque para el detalle de los 5
// criterios. Mismos helpers que layout-dos-zonas.e2e.ts (partida real
// sembrada, nunca un mock de la simulación): un turno real es la única forma
// honesta de comprobar que el canal de estado cambia de verdad.
const VIEWPORT_MOVIL = { width: 360, height: 640 };

async function irAPartida(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORT_MOVIL);
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

async function dispararTurnoReal(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  const bromasAntes = (await page.evaluate(() => window.__debug.historialBromas?.length ?? 0)) as number;
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    (antes) => (window.__debug.historialBromas?.length ?? 0) > antes,
    bromasAntes,
    { timeout: 60000 },
  );
}

// hud-canales-1 (quinta corrección): el fallo real estaba en el estado de
// apuntado INICIAL -- antes de cualquier disparo, la primera pantalla que
// ve cualquier jugador -- donde fila-avisos reservaba 78px fijos aunque no
// hubiera roce, aviso ni broma que mostrar, y ese hueco vacío era
// exactamente lo que le faltaba al botón Disparar para no salir cortado.
// Las tres vueltas anteriores de este bloque solo capturaban DESPUÉS de un
// disparo (el gatekeeper lo señaló expresamente: "mis capturas eran todas
// posteriores a un disparo"), así que nunca ejercitaban este estado.
function sinDesbordeDeViewport(caja: { y: number; height: number }, altoViewport: number): boolean {
  return caja.y >= 0 && caja.y + caja.height <= altoViewport + 1;
}

// hud-canales-1 (undécima corrección): la etiqueta de deriva es texto de
// canvas (Phaser), no DOM -- boundingBox() no la ve. Se mide con los bordes
// reales que IndicadorDeriva calcula tras el wordWrap (ver
// window.__debug.deriva), convertidos a CSS px, contra el ancho real del
// lienzo medido con getBoundingClientRect: el mismo par de números que el
// gatekeeper leía a ojo sobre la captura, pero exacto y automático.
test("hud-canales-1: la etiqueta de deriva cabe dentro del lienzo a 360x640, en los tres mapas del catálogo", async ({
  page,
}) => {
  test.setTimeout(30000);
  for (const idMapa of ["desguace-del-ecuador", "calma-de-los-restos", "corriente-de-estribor"]) {
    await page.setViewportSize(VIEWPORT_MOVIL);
    await page.goto(`/?mapa=${idMapa}`);
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.deriva !== undefined);

    const medidas = await page.evaluate(() => {
      const lienzo = document.querySelector("#game-container canvas")!.getBoundingClientRect();
      return { anchoLienzoCss: lienzo.width, deriva: window.__debug.deriva! };
    });

    expect(
      medidas.deriva.etiquetaBordeIzquierdoCssPx,
      `mapa ${idMapa}, etiqueta se sale por la izquierda: ${JSON.stringify(medidas)}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      medidas.deriva.etiquetaBordeDerechoCssPx,
      `mapa ${idMapa}, etiqueta se sale por la derecha: ${JSON.stringify(medidas)}`,
    ).toBeLessThanOrEqual(medidas.anchoLienzoCss);
  }
});

test("hud-canales-1: en el estado de apuntado inicial ningún control sale del viewport", async ({ page }) => {
  test.setTimeout(30000);
  await irAPartida(page);

  for (const testId of ["selector-arma-abrir", "repetir-disparo", "disparar", "control-angulo", "control-potencia"]) {
    const caja = (await page.getByTestId(testId).boundingBox())!;
    expect(sinDesbordeDeViewport(caja, VIEWPORT_MOVIL.height), `${testId} fuera del viewport: ${JSON.stringify(caja)}`).toBe(true);
  }

  // Ningún panel con overflow debe recortar contenido: el gatekeeper midió
  // scrollHeight > clientHeight en panel-bromas con el ancho compartido de
  // antes -- esta aserción lo habría cazado sin depender de leer una
  // captura a ojo.
  const desbordesDeContenido = await page.evaluate((testIds: string[]) => {
    return testIds
      .map((testId) => {
        const el = document.querySelector(`[data-testid="${testId}"]`);
        if (el === null) return null;
        return { testId, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
      })
      .filter((r): r is { testId: string; scrollHeight: number; clientHeight: number } => r !== null && r.scrollHeight > r.clientHeight + 1);
  }, ["fila-avisos", "aviso-accion-imposible", "panel-bromas", "panel-roce"]);
  expect(desbordesDeContenido, JSON.stringify(desbordesDeContenido)).toEqual([]);

  await page.screenshot({ path: "capturas/hud-canales-1-inicial-360x640.png" });
});

test("hud-canales-1: el canal de estado es permanente y la broma se desvanece sola en <=6s", async ({ page }) => {
  test.setTimeout(60000);
  await irAPartida(page);

  await expect(page.getByTestId("canal-estado")).toBeVisible();
  await expect(page.getByTestId("integridad-nave-0")).toBeVisible();
  await expect(page.getByTestId("integridad-nave-1")).toBeVisible();

  await dispararTurnoReal(page);
  await expect(page.getByTestId("canal-estado")).toBeVisible();
  await expect(page.getByTestId("panel-bromas")).toBeVisible();

  // hud-canales-1 (undécima corrección): el caso que ningún oráculo
  // anterior cubría -- disparo + impacto publicados a la vez, que es lo
  // normal en todo turno resuelto (hum-1 garantiza que siempre hay impacto,
  // y un disparo ya está en pantalla). lay-3/hud-canales-4 miran solape y
  // objetivo táctil, nunca clientHeight contra scrollHeight con las DOS
  // bromas a la vez, que es justo donde se cortaba la última línea a media
  // letra.
  const medidasPanelBromas = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="panel-bromas"]')!;
    return { clientHeight: el.clientHeight, scrollHeight: el.scrollHeight };
  });
  expect(
    medidasPanelBromas.clientHeight,
    `panel-bromas corta contenido: ${JSON.stringify(medidasPanelBromas)}`,
  ).toBeGreaterThanOrEqual(medidasPanelBromas.scrollHeight);

  await page.screenshot({ path: "capturas/hud-canales-1-360x640.png" });

  // Se espera a que también resuelva el turno de la máquina -- su propia
  // broma reiniciaría el temporizador de desvanecido, igual que lay-4 espera
  // lo mismo antes de descartar a mano (misma carrera real, no del test).
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="panel-bromas"]') === null,
    undefined,
    { timeout: 7000 },
  );
  await expect(page.getByTestId("canal-estado")).toBeVisible();
});

test("hud-canales-2: disparar cambia el indicador de turno y el histórico gana una entrada", async ({ page }) => {
  test.setTimeout(60000);
  await irAPartida(page);

  const turnoAntes = await page.evaluate(() => window.__debug.turno);
  expect(await page.evaluate(() => window.__debug.historialBromas?.length ?? 0)).toBe(0);

  await dispararTurnoReal(page);

  const turnoDespues = await page.evaluate(() => window.__debug.turno);
  expect(turnoDespues).not.toBe(turnoAntes);
  expect(await page.evaluate(() => window.__debug.historialBromas?.length ?? 0)).toBeGreaterThanOrEqual(1);
});

test("hud-canales-3: histórico de bromas vacío al empezar, dos entradas en orden tras dos disparos", async ({
  page,
}) => {
  test.setTimeout(90000);
  await irAPartida(page);

  // hud-canales-3: "accesible desde el canal de estado" -- un botón ahí
  // mismo, no una fila permanente (lay-5 no deja presupuesto de alto para
  // una fila más en 360x640).
  await page.getByTestId("historico-bromas-toggle").click();
  await expect(page.getByTestId("historico-bromas-vacio")).toHaveText("Aún no hay mensajes: aquí aparecerán las bromas y avisos de la partida.");
  await page.getByTestId("historico-bromas-cerrar").click();

  await dispararTurnoReal(page);
  await page.getByTestId("historico-bromas-toggle").click();
  await expect(page.getByTestId("historico-bromas-entrada-0")).toBeVisible();
  await page.getByTestId("historico-bromas-cerrar").click();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await dispararTurnoReal(page);
  await page.getByTestId("historico-bromas-toggle").click();
  await expect(page.getByTestId("historico-bromas-entrada-1")).toBeVisible();
});

// hud-canales (tercera corrección): el axe se mueve al instante EN VUELO
// (como ya hace hud-canales-5), no tras la resolución completa -- después de
// resolver, aviso-accion-imposible ya no existe y el gatekeeper encontró
// justo ahí el hueco de cobertura (su propio contraste nunca llegó a
// comprobarse). El guardia de solape ya NO compara contra una lista fija de
// vecinos -- esa lista fue precisamente el hueco que dejó pasar el solape
// real de la iteración anterior (broma contra roce, broma contra aviso):
// ninguno de los dos estaba en "vecinosFilaArmas" ni en
// "toggle-sacudida"/"toggle-silenciado". Ahora se recoge la caja de TODOS
// los paneles visibles en el instante (incluido broma-descartar como hijo
// de panel-bromas, que sí puede solaparse con su propio padre a propósito)
// y se comparan por parejas entre sí.
test("hud-canales-4: sin violaciones de target-size/color-contrast y ningún panel visible se superpone a otro", async ({
  page,
}) => {
  test.setTimeout(60000);
  await irAPartida(page);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === false);

  const resultados = await new AxeBuilder({ page }).withRules(["target-size", "color-contrast"]).analyze();
  expect(resultados.violations).toEqual([]);

  function sinSolape(cajaA: { x: number; y: number; width: number; height: number }, cajaB: { x: number; y: number; width: number; height: number }): boolean {
    return (
      cajaA.x + cajaA.width <= cajaB.x + 1 ||
      cajaB.x + cajaB.width <= cajaA.x + 1 ||
      cajaA.y + cajaA.height <= cajaB.y + 1 ||
      cajaB.y + cajaB.height <= cajaA.y + 1
    );
  }

  // panel-bromas/broma-descartar quedan fuera adrede: el aspa vive DENTRO
  // de su propio panel (hud-canales-4 ya lo exige así, no es el solape que
  // se busca aquí). Todo lo demás es independiente entre sí y no debería
  // compartir ni un píxel.
  const candidatos = [
    "aviso-accion-imposible",
    "panel-bromas",
    "panel-roce",
    "selector-arma-abrir",
    "repetir-disparo",
    "disparar",
    "toggle-sacudida",
    "toggle-silenciado",
    "historico-bromas-toggle",
  ];

  const cajas: Array<{ testId: string; caja: { x: number; y: number; width: number; height: number } }> = [];
  for (const testId of candidatos) {
    const locator = page.getByTestId(testId);
    if (!(await locator.isVisible().catch(() => false))) continue;
    cajas.push({ testId, caja: (await locator.boundingBox())! });
  }

  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      expect(sinSolape(cajas[i].caja, cajas[j].caja), `${cajas[i].testId} vs ${cajas[j].testId}`).toBe(true);
    }
  }

  const panel = page.getByTestId("panel-bromas");
  if (await panel.isVisible().catch(() => false)) {
    const cajaPanel = (await panel.boundingBox())!;
    const cajaDescartar = (await page.getByTestId("broma-descartar").boundingBox())!;
    expect(cajaDescartar.x).toBeGreaterThanOrEqual(cajaPanel.x - 1);
    expect(cajaDescartar.y).toBeGreaterThanOrEqual(cajaPanel.y - 1);
    expect(cajaDescartar.x + cajaDescartar.width).toBeLessThanOrEqual(cajaPanel.x + cajaPanel.width + 1);
    expect(cajaDescartar.y + cajaDescartar.height).toBeLessThanOrEqual(cajaPanel.y + cajaPanel.height + 1);
  }
});

test("hud-canales-5: disparar durante un vuelo en curso explica la causa y no encola un segundo disparo", async ({
  page,
}) => {
  test.setTimeout(60000);
  await irAPartida(page);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === false);

  await expect(page.getByTestId("aviso-accion-imposible")).toBeVisible();
  const texto = (await page.getByTestId("aviso-accion-imposible").textContent())!.toLowerCase();
  expect(texto).toContain("espera");
  await expect(page.getByTestId("disparar")).toBeDisabled();
});
