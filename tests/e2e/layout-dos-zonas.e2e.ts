import { test, expect, type Page } from "@playwright/test";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";

// layout-dos-zonas: el HUD deja de superponerse al lienzo -- la pantalla se
// parte en zona de juego (arriba, "zona-juego"/#game-container) y consola
// (abajo, "consola") con todo lo interactivo. "El lienzo" de lay-1 es la
// zona de juego reservada, no el <canvas> real: a 360px de ancho el propio
// Scale.FIT (16:9, MUNDO_ANCHO/MUNDO_ALTO fijos) limita el <canvas> a ~202px
// de alto SIEMPRE, sin importar cuánto crezca su contenedor -- ampliarlo no
// sube el render (nota del propio diseño), solo despeja sitio para el HUD.

const VIEWPORT_MOVIL = { width: 360, height: 640 };
const VIEWPORT_ESCRITORIO = { width: 1280, height: 800 };

async function irAPartida(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

function seSolapan(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Dispara un turno real con el ajuste que ya tenga el HUD (no hace falta
// puntería exacta: lay-3/lay-4/lay-5 solo necesitan que el turno SE
// RESUELVA de verdad -- acierto, fallo o roce dan igual). Espera al
// historial de bromas (hum-1) en vez de a numeroTurno porque un disparo de
// la máquina también incrementa numeroTurno sin que le toque al jugador.
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

const TESTIDS_HUD = [
  "resultado-turno",
  "reticulo",
  "paso-angulo-mas",
  "paso-angulo-menos",
  "selector-arma-abrir",
  "repetir-disparo",
  "disparar",
  "panel-bromas",
  "panel-roce",
  "integridad-nave-0",
  "integridad-nave-1",
];

// pantalla-completa: lay-1 ("la consola no solapa la zona de juego") quedó
// obsoleto por diseño -- el lienzo ocupa ya el viewport entero y la consola es
// una capa encima. Lo que se sigue exigiendo es que ningún control se salga de
// la consola y que esta no pase del 45 % del alto.
test("lay-1: en 360x640 el lienzo ocupa el viewport y todo el HUD cabe dentro de la consola superpuesta (≤ 40 % del alto)", async ({
  page,
}) => {
  await irAPartida(page, VIEWPORT_MOVIL);

  const zonaJuego = (await page.getByTestId("zona-juego").boundingBox())!;
  expect(zonaJuego.height).toBeGreaterThanOrEqual(VIEWPORT_MOVIL.height - 1);
  expect(zonaJuego.width).toBeGreaterThanOrEqual(VIEWPORT_MOVIL.width - 1);

  const consola = (await page.getByTestId("consola").boundingBox())!;
  expect(consola.height / VIEWPORT_MOVIL.height).toBeLessThanOrEqual(0.4 + 0.002);

  for (const testId of TESTIDS_HUD) {
    // consola-compacta: las bromas y el aviso de roce flotan sobre el borde
    // superior de la consola, ya no viven dentro de su caja.
    if (testId === "panel-bromas" || testId === "panel-roce") continue;
    const locator = page.getByTestId(testId);
    if (!(await locator.isVisible().catch(() => false))) continue;
    const caja = (await locator.boundingBox())!;
    expect(caja.y, `${testId} no debe quedar por encima de la consola`).toBeGreaterThanOrEqual(consola.y - 1);
  }

  await page.screenshot({ path: "capturas/layout-dos-zonas-1-zonas-360x640.png" });
});

for (const [nombreViewport, viewport] of Object.entries({ "360x640": VIEWPORT_MOVIL, "1280x800": VIEWPORT_ESCRITORIO })) {
  test(`lay-2: a ${nombreViewport} ningún texto del HUD se corta (arma más larga y resultado del turno)`, async ({
    page,
  }) => {
    await irAPartida(page, viewport);

    const armaMasLarga = [...CATALOGO_ARMAS].sort((a, b) => b.nombre.length - a.nombre.length)[0];
    await page.getByTestId("selector-arma-abrir").click();
    await page.getByTestId(`arma-${armaMasLarga.id}`).click();

    for (const testId of ["selector-arma-abrir", "resultado-turno"]) {
      const locator = page.getByTestId(testId);
      const desborde = await locator.evaluate((el) => ({
        ancho: el.scrollWidth > el.clientWidth + 1,
        alto: el.scrollHeight > el.clientHeight + 1,
      }));
      expect(desborde.ancho, `${testId} no debe cortar texto por ancho`).toBe(false);
      expect(desborde.alto, `${testId} no debe cortar texto por alto`).toBe(false);
    }
  });
}

for (const [nombreViewport, viewport] of Object.entries({ "360x640": VIEWPORT_MOVIL, "1280x800": VIEWPORT_ESCRITORIO })) {
  test(`lay-3: a ${nombreViewport} el panel de broma nunca solapa ángulo, potencia, arma ni disparar`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await irAPartida(page, viewport);

    const controles = ["reticulo", "paso-angulo-mas", "paso-angulo-menos", "selector-arma-abrir", "disparar"];

    async function comprobarSinSolape(): Promise<void> {
      const panel = page.getByTestId("panel-bromas");
      if (!(await panel.isVisible().catch(() => false))) return;
      const cajaPanel = (await panel.boundingBox())!;
      for (const testId of controles) {
        const cajaControl = (await page.getByTestId(testId).boundingBox())!;
        expect(seSolapan(cajaPanel, cajaControl), `panel-bromas no debe solapar ${testId}`).toBe(false);
      }
    }

    // Un turno real deja publicadas a la vez la broma de disparo y la de
    // impacto (hum-1: "sin excepción") -- primer estado a comprobar.
    await dispararTurnoReal(page);
    await comprobarSinSolape();

    // Segundo turno del jugador (tras la respuesta de la máquina): dos
    // bromas seguidas sustituyendo a las anteriores.
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
    await dispararTurnoReal(page);
    await comprobarSinSolape();
  });
}

test("lay-4: la broma se descarta con un objetivo >=44x44 sin mover el resto de controles", async ({ page }) => {
  test.setTimeout(60000);
  await irAPartida(page, VIEWPORT_MOVIL);
  await dispararTurnoReal(page);
  // Se espera a que la máquina también resuelva su turno antes de descartar:
  // si no, su propia broma puede sustituir a la del jugador justo entre la
  // lectura de las cajas "antes" y el click, y el descarte compararía contra
  // una clave ya vieja (carrera real, no del test).
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
  await expect(page.getByTestId("panel-bromas")).toBeVisible();

  const controles = ["reticulo", "paso-angulo-mas", "paso-angulo-menos", "selector-arma-abrir", "disparar"];
  const cajasAntes = await Promise.all(controles.map(async (testId) => (await page.getByTestId(testId).boundingBox())!));

  const descarte = page.getByTestId("broma-descartar");
  await expect(descarte).toBeVisible();
  const cajaDescarte = (await descarte.boundingBox())!;
  expect(cajaDescarte.width).toBeGreaterThanOrEqual(44);
  expect(cajaDescarte.height).toBeGreaterThanOrEqual(44);

  await descarte.click();
  await expect(page.getByTestId("panel-bromas")).toHaveCount(0);

  const cajasDespues = await Promise.all(controles.map(async (testId) => (await page.getByTestId(testId).boundingBox())!));
  expect(cajasDespues).toEqual(cajasAntes);
});

test("lay-5 (HITO): en 360x640 se juega un turno completo con el layout nuevo, sin scroll horizontal ni controles fuera de la ventana", async ({
  page,
}) => {
  test.setTimeout(90000);
  await irAPartida(page, VIEWPORT_MOVIL);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEWPORT_MOVIL.width);

  for (const testId of TESTIDS_HUD) {
    const locator = page.getByTestId(testId);
    if (!(await locator.isVisible().catch(() => false))) continue;
    const caja = (await locator.boundingBox())!;
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.y).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(VIEWPORT_MOVIL.width + 1);
    expect(caja.y + caja.height).toBeLessThanOrEqual(VIEWPORT_MOVIL.height + 1);
  }

  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId(`arma-${CATALOGO_ARMAS[0].id}`).click();

  const surco = page.getByTestId("superficie-arrastre");
  const cajaSurco = (await surco.boundingBox())!;
  const inicio = { x: cajaSurco.x + cajaSurco.width * 0.3, y: cajaSurco.y + cajaSurco.height * 0.8 };
  const fin = { x: cajaSurco.x + cajaSurco.width * 0.7, y: cajaSurco.y + cajaSurco.height * 0.2 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  const numeroTurnoAntes = await page.evaluate(() => window.__debug.numeroTurno);
  await dispararTurnoReal(page);
  await page.waitForFunction(
    (turnoAntes) => (window.__debug.numeroTurno ?? 0) > (turnoAntes ?? 0),
    numeroTurnoAntes,
    { timeout: 20000 },
  );

  const textoResultado = await page.evaluate(() => window.__debug.resultadoTurno);
  expect((textoResultado ?? "").length).toBeGreaterThan(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEWPORT_MOVIL.width);
});

// Deben coincidir con src/juego/control/apuntado.ts (mismo criterio de
// duplicación deliberada que control-1.e2e.ts): la potencia depende del
// arrastre HORIZONTAL (deltaHorizontal), no del vertical -- ese era justo el
// eje que este test tenía mal antes de este ajuste.
const GANANCIA_POTENCIA = 150;
const POTENCIA_INICIAL = 50;

test("lay-6: estado vacío inicial y aviso de potencia a 0 nombran la causa", async ({ page }) => {
  await irAPartida(page, VIEWPORT_MOVIL);

  // Estado vacío: antes de disparar, el panel dice qué va a aparecer ahí
  // (esp-6, ya cubierto -- aquí solo se comprueba que sigue no-vacío tras
  // el rediseño de la consola).
  const textoInicial = (await page.getByTestId("resultado-turno").textContent())!.trim();
  expect(textoInicial.length).toBeGreaterThan(0);

  // Potencia a 0: arrastrar hacia la IZQUIERDA (deltaHorizontal negativo)
  // la satura en 0 (potenciaTrasArrastre, ver apuntado.ts) -- acción
  // imposible con causa explicada en pantalla. El delta se calcula como
  // fracción del ANCHO DE VENTANA completo (fraccionDeVentana usa
  // window.innerWidth, no el propio recuadro de la superficie de arrastre:
  // mismo criterio ya probado en control-1.e2e.ts), con margen sobre el
  // -0.334 que ya bastaría para llegar a 0.
  const surco = page.getByTestId("superficie-arrastre");
  const caja = (await surco.boundingBox())!;
  const deltaHorizontal = -(POTENCIA_INICIAL / GANANCIA_POTENCIA) - 0.1;
  const inicioX = caja.x + caja.width * 0.9;
  const y = caja.y + caja.height * 0.5;
  await page.mouse.move(inicioX, y);
  await page.mouse.down();
  await page.mouse.move(inicioX + deltaHorizontal * VIEWPORT_MOVIL.width, y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => (window.__debug.control?.ajuste.potencia ?? 100) <= 0);
  await expect(page.getByTestId("aviso-accion-imposible")).toBeVisible();
  const texto = (await page.getByTestId("aviso-accion-imposible").textContent())!;
  expect(texto.toLowerCase()).toContain("potencia");
});
