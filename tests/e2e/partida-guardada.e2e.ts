import { test, expect, type Page } from "@playwright/test";
import { CLAVE_PARTIDA_GUARDADA } from "@/juego/partidaGuardada/almacen";

// partida-guardada-flujo: se juega por la portada real y se recarga la página,
// que es lo que le pasa a una persona cuando el navegador mata la pestaña.
const MAPA_SEMBRADO = "calma-de-los-restos";
const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
];

// Aquí sí se guarda: la configuración común lo apaga para el resto de los e2e.
test.use({
  storageState: {
    cookies: [],
    origins: [{ origin: "http://127.0.0.1:3000", localStorage: [{ name: "universo:eventos", value: "0" }, { name: "muerte-subita:activada", value: "0" }] }],
  },
});

async function esperarPartida(page: Page): Promise<void> {
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
}

// El escudo gasta el turno sin depender de la puntería.
async function cerrarTurno(page: Page): Promise<void> {
  const anterior = await page.evaluate(() => window.__debug.numeroTurno!);
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId("equipo-escudo").click();
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, anterior, { timeout: 30000 });
  await page.waitForFunction(() => window.__debug.animacionEnCurso === false && window.__debug.partidaGuardada?.existe === true, undefined, { timeout: 60000 });
}

async function partidaConUnTurno(page: Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("boton-jugar").click();
  await esperarPartida(page);
  await cerrarTurno(page);
}

async function capturas(page: Page, nombre: string): Promise<void> {
  for (const { ancho, alto } of TAMANOS) {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.screenshot({ path: `capturas/partida-guardada-flujo-9-${nombre}-${ancho}x${alto}.png` });
  }
}

test("pgf-1/2/3/4/5: se guarda al cerrar turno, la portada ofrece continuar y se retoma en el mismo turno", async ({ page }) => {
  test.setTimeout(240000);
  await partidaConUnTurno(page);
  const guardada = await page.evaluate(() => window.__debug.partidaGuardada!);
  expect(guardada.error).toBeNull();
  expect(guardada.ultimoGuardadoMs).toBeLessThan(200);
  const turno = await page.evaluate(() => window.__debug.numeroTurno!);
  const mundo = await page.evaluate(() => ({ ...window.__debug.mundo! }));

  await page.setViewportSize({ width: 360, height: 640 });
  await page.reload();
  await expect(page.getByTestId("continuar-partida")).toBeVisible();
  await expect(page.getByTestId("continuar-partida")).toContainText("ronda");
  await expect(page.getByTestId("continuar-partida")).toContainText("Se guarda sola");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await capturas(page, "portada-continuar");

  await page.setViewportSize({ width: 360, height: 640 });
  await page.getByTestId("continuar-partida-boton").click();
  await esperarPartida(page);
  expect(await page.evaluate(() => window.__debug.numeroTurno!)).toBe(turno);
  expect(await page.evaluate(() => ({ ...window.__debug.mundo! }))).toEqual(mundo);
  await capturas(page, "partida-retomada");
});

test("pgf-6/7: descartar pide confirmación con foco en cancelar; jugar con partida guardada pide confirmar", async ({ page }) => {
  test.setTimeout(240000);
  await partidaConUnTurno(page);
  await page.reload();
  await page.getByTestId("descartar-partida-boton").click();
  await expect(page.getByTestId("confirmar-descarte-no")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("confirmar-descarte")).toHaveCount(0);
  expect(await page.evaluate((c) => localStorage.getItem(c), CLAVE_PARTIDA_GUARDADA)).not.toBeNull();

  await page.getByTestId("boton-jugar").click();
  await expect(page.getByTestId("confirmar-nueva-partida")).toBeVisible();
  await page.getByTestId("confirmar-nueva-partida-no").click();
  await expect(page.getByTestId("continuar-partida")).toBeVisible();

  await page.getByTestId("descartar-partida-boton").click();
  await page.getByTestId("confirmar-descarte-si").click();
  await expect(page.getByTestId("continuar-partida")).toHaveCount(0);
  expect(await page.evaluate((c) => localStorage.getItem(c), CLAVE_PARTIDA_GUARDADA)).toBeNull();
});

test("pgf-8: empezar otra partida borra la guardada", async ({ page }) => {
  test.setTimeout(240000);
  await partidaConUnTurno(page);
  await page.reload();
  await page.getByTestId("boton-jugar").click();
  await page.getByTestId("confirmar-nueva-partida-si").click();
  await esperarPartida(page);
  await page.waitForFunction((c) => localStorage.getItem(c) !== null, CLAVE_PARTIDA_GUARDADA, { timeout: 10000 }).catch(() => undefined);
  const numero = await page.evaluate(() => window.__debug.numeroTurno!);
  expect(numero).toBeLessThanOrEqual(1);
});

test("pgf-9: una instantánea dañada se borra y la portada lo dice sin impedir jugar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript((c) => localStorage.setItem(c, "{esto no es una partida"), CLAVE_PARTIDA_GUARDADA);
  await page.goto("/");
  await expect(page.getByTestId("aviso-partida-no-recuperable")).toBeVisible();
  await expect(page.getByTestId("continuar-partida")).toHaveCount(0);
  await capturas(page, "no-recuperable");
  await page.setViewportSize({ width: 360, height: 640 });
  await page.getByTestId("aviso-partida-entendido").click();
  await expect(page.getByTestId("aviso-partida-no-recuperable")).toHaveCount(0);
  await expect(page.getByTestId("boton-jugar")).toBeEnabled();
});

test("pgf-12/13: sin almacenamiento la partida sigue y avisa una vez", async ({ page }) => {
  test.setTimeout(240000);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("lleno", "QuotaExceededError");
    };
  });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("boton-jugar").click();
  await esperarPartida(page);
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId("pestana-equipo").click();
  await page.getByTestId("equipo-escudo").click();
  await page.getByTestId("disparar").click();
  // El aviso dura 4 s y el turno tarda en cerrarse: se espera con margen.
  await expect(page.getByTestId("aviso-sin-guardado")).toContainText("guardar", { timeout: 60000 });
  await capturas(page, "aviso-sin-guardado");
  expect(await page.evaluate(() => window.__debug.partidaGuardada!.error)).not.toBeNull();
});
