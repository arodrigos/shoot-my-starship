import { test, expect } from "@playwright/test";
import { ratioDeContraste, RATIO_MINIMO_TEXTO } from "../utils/contraste";

// contacto-honesto: aterrizar un vuelo real justo en la banda de roce (fuera
// del radio de colisión, dentro de la silueta dibujada -- unos pocos píxeles
// de margen) no es reproducible apuntando a mano de forma determinista, así
// que con-2/con-3/con-6 se comprueban disparando el mismo camino de
// presentación que usa un turno real (window.__debug.dispararEventoRoce /
// dispararEventoImpactoReal, ver Partida.ts:manejarEventosVisuales) en vez de
// una trayectoria balística exacta. con-1 (clasificación pura) y con-5 (no
// regresión) ya están cubiertos por tests/unit/impacto/con-1.test.ts.
test("contacto-honesto: roce (con-3, con-6) se anuncia sin tocar la integridad y sin solapar los otros paneles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const integridadAntes = (await page.evaluate(() => window.__debug.naves))!.map((n) => n.integridad);

  await page.evaluate(() => window.__debug.dispararEventoRoce!(1, 200, 300));

  // con-3: mensaje propio en el DOM, no el panel de resultado del turno.
  const panelRoce = page.getByTestId("panel-roce");
  await expect(panelRoce).toBeVisible();
  const textoRoce = (await panelRoce.textContent())!.trim();
  expect(textoRoce.length).toBeGreaterThan(0);
  // con-6: texto de ayuda accesible -- anunciado vía role="status" (aria-live
  // implícito), no solo color/forma.
  await expect(panelRoce).toHaveAttribute("role", "status");

  // con-3: la integridad no cambia por un roce.
  const integridadDespues = (await page.evaluate(() => window.__debug.naves))!.map((n) => n.integridad);
  expect(integridadDespues).toEqual(integridadAntes);

  // con-6: el panel de roce no solapa ni con resultado-turno ni con
  // panel-bromas.
  const cajaRoce = (await panelRoce.boundingBox())!;
  for (const testId of ["resultado-turno", "panel-bromas"]) {
    const locator = page.getByTestId(testId);
    if (!(await locator.isVisible())) continue;
    const caja = (await locator.boundingBox())!;
    const seSolapan =
      cajaRoce.x < caja.x + caja.width &&
      cajaRoce.x + cajaRoce.width > caja.x &&
      cajaRoce.y < caja.y + caja.height &&
      cajaRoce.y + cajaRoce.height > caja.y;
    expect(seSolapan).toBe(false);
  }

  await page.screenshot({ path: "capturas/contacto-honesto-1-roce.png" });
});

test("contacto-honesto: el impacto real destella el núcleo en el punto de contacto (con-2)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const PUNTO_X = 210;
  const PUNTO_Y = 340;
  await page.evaluate(
    ({ x, y }) => window.__debug.dispararEventoImpactoReal!(1, x, y),
    { x: PUNTO_X, y: PUNTO_Y },
  );

  const destellos = (await page.evaluate(() => window.__debug.destellosNucleo))!;
  expect(destellos.length).toBeGreaterThan(0);
  const ultimo = destellos[destellos.length - 1];
  expect(ultimo.nave).toBe(1);
  // con-2: el punto de contacto queda centrado en la resolución real, ±2px.
  expect(Math.abs(ultimo.x - PUNTO_X)).toBeLessThanOrEqual(2);
  expect(Math.abs(ultimo.y - PUNTO_Y)).toBeLessThanOrEqual(2);
});

test("contacto-honesto: el núcleo real se dibuja a escala exacta y se realza al entrar en modo de apuntado (con-4)", async ({
  page,
}) => {
  const RADIO_CASCO_NAVE_PX = 22;

  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.naves !== undefined && window.__debug.geometria !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // esc-1/con-4: el radio del casco real de colisión no cambia con la
  // escala de dibujo (opción B) -- se comprueba contra la constante conocida
  // del diseño, no contra un valor derivado del propio dibujo.
  const geometria = (await page.evaluate(() => window.__debug.geometria))!;
  expect(geometria.radioCascoColisionPx).toBe(RADIO_CASCO_NAVE_PX);

  // con-4: es el turno del jugador (modo de apuntado) -- el núcleo realzado
  // debe ser el de la nave OBJETIVO (la rival, id 1), nunca null.
  await page.waitForFunction(() => window.__debug.control?.puedeDisparar === true);
  await page.waitForFunction(() => window.__debug.nucleoRealzado !== null && window.__debug.nucleoRealzado !== undefined);
  const realzadoApuntando = await page.evaluate(() => window.__debug.nucleoRealzado);
  expect(realzadoApuntando).toBe(1);

  await page.screenshot({ path: "capturas/contacto-honesto-2-nucleo-realzado.png" });
});

// con-3 (gatekeeper, iteración 6): el fondo con alfa 0,16 que llevaba antes
// el panel de roce daba 1,34:1 en esquema claro (casi ilegible) aunque en
// oscuro se viera bien -- Playwright arranca en claro por defecto, así que
// el fallo pasaba desapercibido si solo se miraba un esquema. Se comprueba
// aquí, explícitamente, en los dos.
test("contacto-honesto: el panel de roce cumple 4,5:1 de contraste en los dos esquemas (con-3)", async ({ page }) => {
  for (const esquema of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: esquema });
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/?mapa=calma-de-los-restos");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.naves !== undefined);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) {
      await page.getByTestId("ayuda-cerrar").click();
    }

    await page.evaluate(() => window.__debug.dispararEventoRoce!(1, 200, 300));

    const panelRoce = page.getByTestId("panel-roce");
    await expect(panelRoce).toBeVisible();
    const { fondo, texto } = await panelRoce.evaluate((el) => {
      const estilo = getComputedStyle(el);
      return { fondo: estilo.backgroundColor, texto: estilo.color };
    });

    const ratio = ratioDeContraste(fondo, texto);
    expect(ratio, `esquema ${esquema}: fondo ${fondo}, texto ${texto}`).toBeGreaterThanOrEqual(RATIO_MINIMO_TEXTO);
  }
});
