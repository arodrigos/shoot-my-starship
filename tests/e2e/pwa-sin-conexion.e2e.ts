import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { abrirAjustes, arrastrarBarraHasta } from "./utilesControl";

// pwa-1..pwa-9: único spec que deja actuar al service worker; el resto de la
// suite va con serviceWorkers:'block' (playwright.config.ts) para que nada se
// juzgue servido desde una caché.
test.use({ serviceWorkers: "allow" });

const VIEWPORTS = [
  { nombre: "360x640", ancho: 360, alto: 640 },
  { nombre: "820x1180", ancho: 820, alto: 1180 },
  { nombre: "1180x820", ancho: 1180, alto: 820 },
];

// Solo para dejar evidencia visual al gatekeeper; el CI no define la variable.
async function capturarEnTodos(page: Page, nombre: string): Promise<void> {
  const carpeta = process.env.CAPTURAS_DIR;
  if (carpeta === undefined) return;
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.ancho, height: vp.alto });
    await page.screenshot({ path: `${carpeta}/${nombre}-${vp.nombre}.png` });
  }
  await page.setViewportSize({ width: VIEWPORTS[0].ancho, height: VIEWPORTS[0].alto });
}

async function esperarInstalacion(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__debug?.pwa?.estado === "listo-sin-conexion" && window.__debug.pwa.controlado,
    undefined,
    { timeout: 60_000 },
  );
}

async function jugar(page: Page): Promise<void> {
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.planetas !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
}

async function abrirInstalado(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await esperarInstalacion(page);
  return page;
}

test("pwa-1: tras abrir una vez con red, el juego abre y se juega sin red", async ({ context }) => {
  test.setTimeout(180_000);
  const page = await abrirInstalado(context);
  await context.setOffline(true);
  const respuesta = await page.reload();
  expect(respuesta!.fromServiceWorker()).toBe(true);
  expect(respuesta!.status()).toBe(200);
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  await jugar(page);
  expect((await page.evaluate(() => window.__debug.naves))!.length).toBe(2);
  expect((await page.evaluate(() => window.__debug.planetas))!.length).toBeGreaterThanOrEqual(3);

  const solucion = await page.evaluate(() => window.__debug.solucionMultipozoJugador!());
  expect(solucion).not.toBeNull();
  const turnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await arrastrarBarraHasta(page, "barra-angulo", (solucion!.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS));
  await arrastrarBarraHasta(page, "barra-potencia", (solucion!.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA));
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    (n) => (window.__debug.numeroTurno ?? 0) >= n + 1 && window.__debug.animacionEnCurso === false,
    turnoAntes,
    { timeout: 90_000 },
  );

  // Con la red de vuelta sigue funcionando y no hay aviso de versión nueva.
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  await expect(page.getByTestId("aviso-version-nueva")).toHaveCount(0);
});

test("pwa-3 / pwa-5: cabeceras del worker, alcance /, aviso de 4 s y pie de Ajustes", async ({ context, request }) => {
  test.setTimeout(180_000);
  const sw = await request.get("/serwist/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect(sw.headers()["cache-control"]).toMatch(/no-cache|no-store/);
  expect(sw.headers()["service-worker-allowed"]).toBe("/");

  const page = await context.newPage();
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await expect(page.getByTestId("aviso-listo-sin-conexion")).toBeVisible({ timeout: 60_000 });
  await capturarEnTodos(page, "pwa-sin-conexion-1-aviso-listo");
  await expect(page.getByTestId("aviso-listo-sin-conexion")).toBeHidden({ timeout: 8_000 });
  await esperarInstalacion(page);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.scope === location.origin + "/")).toBe(true);

  await jugar(page);
  await abrirAjustes(page);
  await expect(page.getByTestId("estado-sin-conexion")).toHaveText("Lista para jugar sin conexión");
  await expect(page.getByTestId("version-app")).toHaveText(/^Versión ([0-9a-f]{7}|local)$/);
  await capturarEnTodos(page, "pwa-sin-conexion-2-pie-ajustes");

  // Sin red, una comprobación forzada deja el motivo a la vista. Playwright no
  // corta la red de la petición de actualización del worker, así que se hace
  // fallar registration.update() como lo haría el navegador sin conexión.
  await page.evaluate(() => {
    ServiceWorkerRegistration.prototype.update = () => Promise.reject(new TypeError("Failed to fetch"));
  });
  await context.setOffline(true);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByTestId("estado-sin-conexion")).toHaveText("Sin red: no se ha podido comprobar si hay versión nueva", { timeout: 20_000 });
  await capturarEnTodos(page, "pwa-sin-conexion-3-comprobacion-sin-red");
  await context.setOffline(false);
});

test("pwa-5: tras recargar con el worker ya activo, el pie dice que está lista (no 'Preparando')", async ({ context }) => {
  test.setTimeout(180_000);
  const page = await abrirInstalado(context);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await jugar(page);
  await abrirAjustes(page);
  await expect(page.getByTestId("estado-sin-conexion")).toHaveText("Lista para jugar sin conexión", { timeout: 20_000 });
});

test("pwa-2: la versión nueva se avisa, no se aplica sola, y Recargar recarga una vez", async ({ context }) => {
  test.setTimeout(180_000);
  const page = await abrirInstalado(context);
  await page.evaluate(() => { (window as unknown as { __marca: number }).__marca = 1; });
  await page.evaluate(() => window.__debug.pwa!.forzarVersionNueva());
  const aviso = page.getByTestId("aviso-version-nueva");
  await expect(aviso).toBeVisible({ timeout: 5_000 });
  await expect(aviso).toContainText("Hay una versión nueva");
  for (const id of ["recargar-version", "posponer-version"]) {
    expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await capturarEnTodos(page, "pwa-sin-conexion-4-version-nueva");

  // Sin pulsar nada la página no se recarga ni cambia de versión.
  await page.waitForTimeout(5_000);
  expect(await page.evaluate(() => (window as unknown as { __marca?: number }).__marca)).toBe(1);

  // El aviso no pisa el botón Ajustes una vez en partida.
  await jugar(page);
  const solape = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="aviso-version-nueva"]')!.getBoundingClientRect();
    const b = document.querySelector('[data-testid="boton-ajustes"]')!.getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
  expect(solape).toBe(false);

  // Se cuentan eventos load y no framenavigated: este también salta con los
  // replaceState del router, que no son recargas.
  let navegaciones = 0;
  page.on("load", () => { navegaciones++; });
  await Promise.all([page.waitForEvent("load", { timeout: 30_000 }), page.getByTestId("recargar-version").click()]);
  await page.waitForTimeout(2_000);
  expect(navegaciones).toBe(1);
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  await expect(page.getByTestId("aviso-version-nueva")).toHaveCount(0);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.waiting === null)).toBe(true);
});

test("pwa-2: Luego oculta el aviso y vuelve a salir en la siguiente carga", async ({ context }) => {
  test.setTimeout(180_000);
  const page = await abrirInstalado(context);
  await page.evaluate(() => window.__debug.pwa!.forzarVersionNueva());
  await expect(page.getByTestId("aviso-version-nueva")).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("posponer-version").click();
  await expect(page.getByTestId("aviso-version-nueva")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("aviso-version-nueva")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("boton-jugar")).toBeVisible();
});

test("pwa-8: ?sw=0 desregistra el worker, borra las cachés y recarga sin el parámetro", async ({ context }) => {
  test.setTimeout(180_000);
  const page = await abrirInstalado(context);
  // Se anota el estado al empezar el documento nuevo, antes de que la app
  // vuelva a registrar nada.
  await page.addInitScript(() => {
    const w = window as unknown as { __alCargar?: Promise<{ registros: number; caches: number }> };
    if (location.search === "") {
      w.__alCargar = Promise.all([navigator.serviceWorker.getRegistrations(), caches.keys()]).then(([r, c]) => ({
        registros: r.length,
        caches: c.length,
      }));
    }
  });
  await page.goto("/?sw=0");
  await page.waitForURL((url) => url.pathname === "/" && url.search === "");
  await page.waitForLoadState("load");
  const alCargar = await page.evaluate(() => (window as unknown as { __alCargar: Promise<{ registros: number; caches: number }> }).__alCargar);
  expect(alCargar).toEqual({ registros: 0, caches: 0 });
});
