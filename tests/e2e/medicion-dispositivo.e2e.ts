import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

// Las capturas van a la carpeta del run si CAPTURAS_DIR la define; en el CI
// quedan junto al informe de Playwright.
const CARPETA = process.env.CAPTURAS_DIR ?? "test-results/capturas";
const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
] as const;

async function abrir(page: Page, ancho: number, alto: number, query: string): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto(`/?${query}`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.rendimiento !== undefined, undefined, { timeout: 60000 });
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

async function captura(page: Page, nombre: string, ancho: number, alto: number): Promise<void> {
  await page.screenshot({ path: path.join(CARPETA, `medicion-dispositivo-1-${nombre}-${ancho}x${alto}.png`) });
}

test("md-1: sin ?rendimiento=1 no existe ni el recuadro ni el botón", async ({ page }) => {
  await abrir(page, 360, 640, "mapa=calma-de-los-restos");
  await expect(page.getByTestId("hud-rendimiento")).toHaveCount(0);
  await expect(page.getByTestId("medir-rendimiento")).toHaveCount(0);
  expect(await page.evaluate(() => window.__debug.medicion === undefined || window.__debug.medicion!().estado === "inactiva")).toBe(true);
});

for (const { ancho, alto } of TAMANOS) {
  test(`md-1: el botón «Medir» mide ≥44x44, tiene su aria-label y recibe el toque (${ancho}x${alto})`, async ({ page }) => {
    await abrir(page, ancho, alto, "mapa=calma-de-los-restos&rendimiento=1");
    const boton = page.getByRole("button", { name: "Medir rendimiento" });
    await expect(boton).toBeVisible();
    const caja = (await boton.boundingBox())!;
    expect(caja.width).toBeGreaterThanOrEqual(44);
    expect(caja.height).toBeGreaterThanOrEqual(44);
    await captura(page, "md-1-boton", ancho, alto);
  });
}

for (const { ancho, alto } of [TAMANOS[0], TAMANOS[2]]) {
test(`md-2/3/4/6/7: «Medir» juega solo, los dos disparos impactan y detonan, y entrega el resumen sin red ni tocar la partida (${ancho}x${alto})`, async ({ page, context }) => {
  test.setTimeout(400000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  const peticiones: string[] = [];
  // Cada lienzo nuevo es un remonte de la partida: el guion corre dentro de ella.
  await page.addInitScript(() => {
    const w = window as unknown as { __lienzosNuevos: number };
    w.__lienzosNuevos = 0;
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n instanceof HTMLElement && (n.tagName === "CANVAS" || n.querySelector?.("canvas"))) w.__lienzosNuevos++;
    }).observe(document, { childList: true, subtree: true });
  });
  await abrir(page, ancho, alto, "mapa=calma-de-los-restos&rendimiento=1&tope-medicion=300");
  // La partida guardada se compara byte a byte antes y después (md-6).
  // Solo las claves de la partida guardada: otras (la ayuda vista) se escriben
  // cuando la ayuda aparece, y con el shard cargado eso puede ser después.
  const leerGuardado = (): Promise<string> =>
    page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k.startsWith("partida-completa:partida-guardada") || k.startsWith("partida-guardada:")).sort()));
  const guardadoAntes = await leerGuardado();
  page.on("request", (r) => {
    const url = r.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    // El remonte del lienzo vuelve a pedir al propio servidor sus chunks y workers
    // (en el dispositivo salen de caché); lo que md-7 prohíbe es que algo salga
    // hacia otro origen o que se envíe nada (POST, etc.).
    const propio = new URL(url).origin === new URL(page.url()).origin;
    if (!propio || r.method() !== "GET") peticiones.push(`${r.method()} ${url}`);
  });
  await page.evaluate(() => { (window as unknown as { __lienzosNuevos: number }).__lienzosNuevos = 0; });
  await page.getByTestId("medir-rendimiento").click();
  await expect(page.getByTestId("franja-medicion")).toContainText(/Midiendo · tramo \d de 5/, { timeout: 60000 });
  await expect(page.getByTestId("cancelar-medicion")).toBeVisible();
  await captura(page, "md-2-midiendo", ancho, alto);

  // Si no llega, el mensaje dice en qué tramo se quedó.
  await page.getByTestId("panel-medicion").waitFor({ timeout: 300000 }).catch(async () => {
    const est = await page.evaluate(() => JSON.stringify({ ...window.__debug.medicion!(), texto: null }));
    const turno = await page.evaluate(() => JSON.stringify({ turno: window.__debug.turno, control: window.__debug.control }));
    throw new Error(`la medición no terminó: ${est} ${turno}`);
  });
  const medicion = await page.evaluate(() => window.__debug.medicion!());
  const texto = await page.getByTestId("texto-medicion").inputValue();
  // «incompleta» ya no vale como pase: era justo el fallo que escondía el remonte en bucle.
  expect(medicion.estado, texto).toBe("terminada");
  expect(await page.evaluate(() => (window as unknown as { __lienzosNuevos: number }).__lienzosNuevos)).toBe(1);
  expect(texto).toMatch(/Reposo:/);
  expect(texto).toMatch(/\| Pepinazo /);
  expect(texto).toMatch(/\| Propulsores /);
  // El tirador del registro es el turno en curso al detonar, que ya puede ser el
  // del rival: se identifica cada disparo por su arma.
  const registro = await page.evaluate(() => window.__debug.registroDetonaciones ?? []);
  const detalle = JSON.stringify({ registro, impactos: medicion.impactos, texto });
  expect(registro.some((r) => /^pepinazo/.test(r.armaId)), detalle).toBe(true);
  // El registro no siempre recoge las detonaciones del Racimo (tres perdigones);
  // su disparo se comprueba por lo que el recorrido midió: un impacto propio y la
  // fila de impacto→explosión del tramo.
  // md-3: la cifra central sale con dato en las dos armas, no «sin datos».
  expect(texto).toMatch(/Racimo: .*impacto→explosión \d/);
  expect(texto).toMatch(/Pepinazo: .*impacto→explosión \d/);
  expect(texto).not.toMatch(/impacto→explosión sin datos/);
  // Ningún disparo del humano salió del mundo.
  const marcas = await page.evaluate(() => window.__debug.rendimiento!.marcas.map((m) => m.nombre));
  expect(marcas.filter((n) => n === "impacto").length, detalle).toBeGreaterThanOrEqual(2);
  expect(registro.some((r) => /^pelota-de-chatarra/.test(r.armaId)), detalle).toBe(true);
  expect((await page.evaluate(() => window.__debug.recorridoEmpuje ?? [])).length).toBeGreaterThan(0);
  expect(texto).toContain("Medición de rendimiento");
  expect(texto).toContain("INP de tus toques (no del recorrido)");
  expect(texto).not.toMatch(/NaN|undefined|Infinity|http|\/home/);
  await expect(page.getByTestId("texto-medicion")).toHaveAttribute("readonly", "");
  // md-3: cabe en 360x640
  const caja = (await page.getByTestId("panel-medicion").boundingBox())!;
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(ancho);
  expect(caja.y + caja.height).toBeLessThanOrEqual(alto);
  await captura(page, "md-3-resumen", ancho, alto);
  // md-4: copia automática o aviso de que hay que pulsar «Copiar»
  await expect(page.getByTestId("estado-copia")).toContainText(/Copiado al portapapeles|No se pudo copiar solo: pulsa Copiar o selecciona el texto/);
  // La copia nunca se queda en «pendiente» con el recorrido ya acabado.
  await expect.poll(() => page.evaluate(() => window.__debug.medicion!().copia), { timeout: 15000 }).not.toBe("pendiente");
  await captura(page, "md-4-copia", ancho, alto);
  // md-7: ninguna petición de red durante la medición
  expect(peticiones).toEqual([]);
  // md-6: el guardado no cambia y «Cerrar» vuelve a la portada
  expect(await leerGuardado()).toBe(guardadoAntes);
  await page.getByTestId("cerrar-medicion").click();
  await expect(page.getByTestId("boton-jugar")).toBeVisible({ timeout: 30000 });
});
}

test("md-8: «Cancelar» deja el panel «Medición cancelada» con el estado 'cancelada'", async ({ page }) => {
  test.setTimeout(120000);
  await abrir(page, 360, 640, "mapa=calma-de-los-restos&rendimiento=1");
  await page.getByTestId("medir-rendimiento").click();
  await expect(page.getByTestId("cancelar-medicion")).toBeVisible({ timeout: 60000 });
  await page.getByTestId("cancelar-medicion").click();
  await expect(page.getByTestId("panel-medicion")).toContainText("Medición cancelada", { timeout: 30000 });
  expect(await page.evaluate(() => window.__debug.medicion!().estado)).toBe("cancelada");
  expect(await page.getByTestId("texto-medicion").inputValue()).toContain("INCOMPLETA");
  await captura(page, "md-8-cancelada", 360, 640);
});

test("md-8: al agotar el tope el estado es 'incompleta' con «tiempo agotado»", async ({ page }) => {
  test.setTimeout(120000);
  await abrir(page, 360, 640, "mapa=calma-de-los-restos&rendimiento=1&tope-medicion=4");
  await page.getByTestId("medir-rendimiento").click();
  await expect(page.getByTestId("panel-medicion")).toContainText("tiempo agotado", { timeout: 60000 });
  expect(await page.evaluate(() => window.__debug.medicion!().estado)).toBe("incompleta");
  expect(await page.getByTestId("texto-medicion").inputValue()).toContain("tiempo agotado (INCOMPLETA)");
});
