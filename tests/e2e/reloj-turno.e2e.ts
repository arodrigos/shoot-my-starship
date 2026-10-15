import { test, expect, type Page } from "@playwright/test";

// reloj-turno: se juega por la portada real, en el mapa sembrado de siempre.
const MAPA_SEMBRADO = "calma-de-los-restos";

interface Opciones {
  readonly humanos: number;
  readonly ias: number;
  readonly reloj: "off" | 30 | 45 | 60;
  readonly extra?: string;
  readonly todosVemosTodo?: boolean;
}

async function empezar(page: Page, o: Opciones): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}${o.extra ?? ""}`);
  await page.getByTestId(`humanos-${o.humanos}`).click();
  await page.getByTestId(`ias-${o.ias}`).click();
  if (o.humanos > 1) {
    await page.getByTestId("nombre-jugador-0").pressSequentially("Ana");
    await page.getByTestId("nombre-jugador-1").pressSequentially("Luis");
  }
  if (o.todosVemosTodo) await page.getByTestId("todos-vemos-todo").check();
  await page.getByTestId(`reloj-${o.reloj}`).click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

test("rel-1: el selector arranca en Off, se elige sin desbordar y llega a la partida", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("humanos-2").click();
  await page.getByTestId("ias-0").click();
  await expect(page.getByTestId("reloj-off")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("reloj-30").click();
  await expect(page.getByTestId("reloj-30")).toHaveAttribute("aria-pressed", "true");
  for (const id of ["reloj-off", "reloj-45", "reloj-60"]) await expect(page.getByTestId(id)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("reloj-ayuda")).toBeVisible();
  expect(((await page.getByTestId("reloj-ayuda").textContent()) ?? "").length).toBeGreaterThan(20);
  const medidas = await page.getByTestId("seccion-reloj").evaluate((el) => ({
    ancho: el.scrollWidth,
    cliente: el.clientWidth,
    alto: Math.min(...Array.from(el.querySelectorAll("button")).map((b) => b.getBoundingClientRect().height)),
    filas: new Set(Array.from(el.querySelectorAll("button")).map((b) => Math.round(b.getBoundingClientRect().top))).size,
  }));
  expect(medidas.ancho).toBeLessThanOrEqual(medidas.cliente);
  expect(medidas.alto).toBeGreaterThanOrEqual(44);
  expect(medidas.filas).toBe(1);
  await page.getByTestId("boton-jugar").click();
  await page.waitForFunction(() => window.__debug.relojTurno?.configuradoS === 30);
  expect(await page.evaluate(() => window.__debug.relojTurno!.estado)).toBe("parado");
});

test("rel-2/rel-8: la píldora aparece tras «Soy Ana», baja, y no hay reloj en el relevo; la latencia se mide y se ve en el panel", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, { humanos: 2, ias: 1, reloj: 30, extra: "&rendimiento=1" });
  await expect(page.getByTestId("pantalla-relevo")).toBeVisible();
  await expect(page.getByTestId("reloj-turno")).toHaveCount(0);
  await page.getByTestId("relevo-confirmar").click();
  const pildora = page.getByTestId("integridad-nave-0").getByTestId("reloj-turno");
  await expect(pildora).toBeVisible();
  expect(["30", "29"]).toContain(((await pildora.textContent()) ?? "").trim());
  await page.waitForTimeout(2000);
  const despues = Number(((await pildora.textContent()) ?? "").trim());
  expect(despues).toBeGreaterThanOrEqual(26);
  expect(despues).toBeLessThanOrEqual(29);
  const ms = await page.evaluate(() => window.__debug.latencias!().filter((l) => l.nombre === "reloj-turno").at(-1)?.ms);
  expect(ms).toBeDefined();
  expect(ms!).toBeLessThanOrEqual(200);
  await expect(page.getByTestId("hud-rendimiento")).toContainText(/reloj-turno: \d+ ms/);
});

test("rel-3/rel-4: oculta congela; al agotarse sale el disparo de la mira y el relevo dice «sin tiempo»", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page, { humanos: 2, ias: 0, reloj: 30 });
  await page.getByTestId("relevo-confirmar").click();
  await expect(page.getByTestId("reloj-turno")).toBeVisible();

  // Pestaña oculta 10 s: el número no se mueve (±1 s) y el turno no se resuelve solo.
  const antes = await page.evaluate(() => window.__debug.relojTurno!.restanteMs);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await page.evaluate(() => window.__debug.relojTurno!.estado)).toBe("pausado");
  await page.waitForTimeout(10000);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const vuelta = await page.evaluate(() => window.__debug.relojTurno!);
  expect(vuelta.estado).toBe("corriendo");
  expect(antes - vuelta.restanteMs).toBeLessThanOrEqual(1000);
  expect(await page.evaluate(() => window.__debug.numeroTurno)).toBe(0);

  // Agotarse: dispara con la mira fijada.
  const numeroTurno = await page.evaluate(() => window.__debug.numeroTurno!);
  await page.evaluate(() => window.__debug.fijarApuntado!(40, 60));
  await page.evaluate(() => window.__debug.adelantarRelojTurno!(30000));
  await expect(page.getByTestId("aviso-tiempo-agotado")).toBeVisible();
  await expect(page.getByTestId("aviso-tiempo-agotado")).toContainText("¡Tiempo! Disparo automático");
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurno, { timeout: 30000 });
  const ultimo = await page.evaluate(() => window.__debug.ultimoDisparo!);
  expect(ultimo.anguloGrados).toBe(40);
  expect(ultimo.potencia).toBe(60);
  expect(await page.evaluate(() => window.__debug.numeroTurno!)).toBe(numeroTurno + 1);
  await expect(page.getByTestId("pantalla-relevo")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("relevo-jugador")).toHaveText("Turno de Luis");
  await expect(page.getByTestId("relevo-resumen")).toContainText("sin tiempo");
  await expect(page.getByTestId("reloj-turno")).toHaveCount(0);
  expect(await page.evaluate(() => window.__debug.relojTurno!.estado)).toBe("parado");
});

test("rel-3: al disparar el reloj se para y desaparece durante el vuelo", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, { humanos: 1, ias: 1, reloj: 45 });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await expect(page.getByTestId("reloj-turno")).toBeVisible();
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.relojTurno!.estado === "parado");
  await expect(page.getByTestId("reloj-turno")).toHaveCount(0);
});

test("rel-5/rel-6: sin relevo arranca al poder disparar; en los últimos 10 s es ámbar y sin movimiento no hay animación", async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await empezar(page, { humanos: 1, ias: 1, reloj: 45 });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  const pildora = page.getByTestId("reloj-turno");
  await expect(pildora).toBeVisible();
  expect(["45", "44"]).toContain(((await pildora.textContent()) ?? "").trim());
  await page.evaluate(() => window.__debug.adelantarRelojTurno!(37000));
  await expect(pildora).toHaveAttribute("data-urgente", "true");
  const estilo = await pildora.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { animacion: cs.animationName, transform: cs.transform };
  });
  expect(estilo.animacion).toBe("none");
  expect(estilo.transform).toBe("none");
});

test("rel-6: sin movimiento reducido la píldora urgente late", async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await empezar(page, { humanos: 1, ias: 1, reloj: 45 });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.evaluate(() => window.__debug.adelantarRelojTurno!(37000));
  const animacion = await page.getByTestId("reloj-turno").evaluate((el) => getComputedStyle(el).animationName);
  expect(animacion).toBe("reloj-turno-pulso");
});

test("rel-7: con Off no hay píldora ni reloj en toda la partida", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, { humanos: 1, ias: 1, reloj: "off" });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await expect(page.getByTestId("reloj-turno")).toHaveCount(0);
  expect(await page.evaluate(() => window.__debug.relojTurno!.estado)).toBe("parado");
  await page.evaluate(() => window.__debug.adelantarRelojTurno!(90000));
  expect(await page.evaluate(() => window.__debug.relojTurno!.estado)).toBe("parado");
});
