import { test, expect, type Page } from "@playwright/test";

const MAPA_SEMBRADO = "calma-de-los-restos";

async function empezar(page: Page, reloj: "off" | 30): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId(`reloj-${reloj}`).click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.anuncios !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

const textos = (page: Page) => page.evaluate(() => window.__debug.anuncios!().map((a) => a.texto));

test("an-1/an-2: la región existe vacía, anuncia turno, tiempo y ganador, y no se ve", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, 30);
  const region = page.getByTestId("anuncios-hud");
  await expect(region).toHaveAttribute("role", "status");
  await expect(region).toHaveAttribute("aria-live", "polite");
  await expect(region).toHaveText("");
  await expect(page.getByRole("status").filter({ has: page.locator("[data-testid=anuncios-hud]") })).toHaveCount(0);

  const estilo = await region.evaluate((el) => {
    const css = getComputedStyle(el);
    const caja = el.getBoundingClientRect();
    return { display: css.display, visibility: css.visibility, ancho: caja.width, alto: caja.height, ariaHidden: el.getAttribute("aria-hidden") };
  });
  expect(estilo.display).not.toBe("none");
  expect(estilo.visibility).toBe("visible");
  expect(estilo.ariaHidden).toBeNull();
  expect(estilo.ancho).toBeLessThanOrEqual(1);
  expect(estilo.alto).toBeLessThanOrEqual(1);

  // Tiempo agotado en el turno humano: el aviso se anuncia una sola vez y ya no es role=status.
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.evaluate(() => window.__debug.fijarApuntado!(40, 60));
  await page.evaluate(() => window.__debug.adelantarRelojTurno!(30000));
  await expect(region).toContainText("¡Tiempo! Disparo automático");
  expect((await textos(page)).filter((t) => t === "¡Tiempo! Disparo automático")).toHaveLength(1);
  await expect(page.getByTestId("aviso-tiempo-agotado")).not.toHaveAttribute("role", /.*/);

  // El turno pasa a la IA.
  await page.waitForFunction(() => window.__debug.turno === 1, undefined, { timeout: 30000 });
  await expect.poll(async () => (await textos(page)).some((t) => t.startsWith("Turno de "))).toBe(true);

  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await expect(page.getByTestId("ganador-nombre")).toBeVisible();
  const ganador = (await page.getByTestId("ganador-nombre").textContent()) ?? "";
  await expect(region).toHaveText(ganador);
  const registro = await textos(page);
  expect(registro.at(-1)).toBe(ganador);
  expect(registro.indexOf("¡Tiempo! Disparo automático")).toBeLessThan(registro.length - 1);
});

test("an-1: el cambio de turno nombra al rival; an-2: un anuncio repetido vuelve a mutar el DOM; an-3: nada en localStorage", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, "off");
  const region = page.getByTestId("anuncios-hud");
  await expect(region).toHaveText("");
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.evaluate(() => window.__debug.fijarApuntado!(40, 60));
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.turno === 1, undefined, { timeout: 30000 });
  await expect.poll(async () => (await textos(page)).at(-1) ?? "").toMatch(/^Turno de .+/);

  // La región pasa por vacío antes de cada texto nuevo (así el lector repite
  // también un texto igual al anterior): se registra el contenido en cada mutación.
  await page.evaluate(() => {
    const nodo = document.querySelector("[data-testid=anuncios-hud]")!;
    const visto: string[] = [];
    (window as unknown as { __vistoAnuncios: string[] }).__vistoAnuncios = visto;
    new MutationObserver(() => visto.push(nodo.textContent ?? "")).observe(nodo, { childList: true, characterData: true, subtree: true });
  });
  await page.waitForFunction(() => window.__debug.turno === 0, undefined, { timeout: 60000 });
  await expect(region).toHaveText("Tu turno");
  const visto = await page.evaluate(() => (window as unknown as { __vistoAnuncios: string[] }).__vistoAnuncios);
  expect(visto).toContain("");
  expect(visto.at(-1)).toBe("Tu turno");

  const claves = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => /Turno de|Tu turno|Tiempo|Gana/.test(`${k}${localStorage.getItem(k)}`)),
  );
  expect(claves).toEqual([]);
});
