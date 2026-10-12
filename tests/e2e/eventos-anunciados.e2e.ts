import { test, expect, type Page } from "@playwright/test";
import { CATALOGO_EVENTOS } from "@/sim/universo/catalogoEventos";
import { ANUNCIOS_EVENTOS } from "@/contenido/anunciosEventos";

declare global {
  interface Window {
    __vozAnuncios: { llamadas: Array<{ tipo: string; texto?: string }> };
    __cartelesVistos: Array<{ titulo: string; desde: number; hasta: number | null }>;
  }
}

// El doble registra cada speak y termina la frase al instante, para que el
// test no dependa de las voces del Chromium del CI.
async function instalarDoble(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const llamadas: Window["__vozAnuncios"]["llamadas"] = [];
    window.__vozAnuncios = { llamadas };
    class Utterance extends EventTarget {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: unknown = null;
      constructor(texto = "") {
        super();
        this.text = texto;
      }
    }
    const voces = [{ name: "Voz ES", lang: "es-ES", localService: true }];
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => voces,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        cancel: () => llamadas.push({ tipo: "cancel" }),
        pause: () => undefined,
        resume: () => undefined,
        speak: (u: Utterance) => {
          llamadas.push({ tipo: "speak", texto: u.text });
          setTimeout(() => {
            u.dispatchEvent(new Event("start"));
            u.dispatchEvent(new Event("end"));
          }, 20);
        },
      },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
  });
}

async function empezar(page: Page, ancho = 360, alto = 640): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto("/?eventos=1&modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.forzarEvento !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// Registra dentro de la página cada cartel con su propio reloj: la latencia de
// Playwright entre llamadas falsearía la duración.
async function vigilarCarteles(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__cartelesVistos = [];
    new MutationObserver(() => {
      const nodo = document.querySelector('[data-testid="cartel-evento-titulo"]');
      const actual = window.__cartelesVistos.at(-1);
      const titulo = nodo?.textContent ?? null;
      if (actual !== undefined && actual.hasta === null && actual.titulo !== titulo) actual.hasta = performance.now();
      if (titulo !== null && (window.__cartelesVistos.at(-1) === undefined || window.__cartelesVistos.at(-1)!.hasta !== null)) {
        window.__cartelesVistos.push({ titulo, desde: performance.now(), hasta: null });
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
] as const;

async function capturar(page: Page, nombre: string, ancho: number, alto: number): Promise<void> {
  const carpeta = process.env.CAPTURAS_DIR;
  if (carpeta) await page.screenshot({ path: `${carpeta}/${nombre}-${ancho}x${alto}.png` });
}

// anu-1 (camino crítico): los 11 eventos se anuncian con título, a quién y qué
// hacen; el cartel cabe sin cortarse y se lee por voz con el anuncio entero.
for (const { ancho, alto } of TAMANOS) {
  test(`anu-1: a ${ancho}x${alto} cada uno de los ${CATALOGO_EVENTOS.length} eventos se anuncia con título, afectado y efecto`, async ({ page }) => {
    test.setTimeout(240000);
    await instalarDoble(page);
    await empezar(page, ancho, alto);
    const cartel = page.getByTestId("cartel-evento");
    for (const definicion of CATALOGO_EVENTOS) {
      const anuncio = ANUNCIOS_EVENTOS[definicion.tipo];
      const habladasAntes = await page.evaluate(() => window.__vozAnuncios.llamadas.filter((l) => l.tipo === "speak").length);
      await page.evaluate((tipo) => window.__debug.forzarEvento!(tipo, 1), definicion.tipo);
      await expect(cartel).toBeVisible();
      // Antes de cualquier otro aserto: el cartel se va solo a los 4 s.
      if (definicion.tipo === "virus" || definicion.tipo === "terremoto") await capturar(page, `eventos-anunciados-${definicion.tipo}`, ancho, alto);
      await expect(page.getByTestId("cartel-evento-titulo")).toHaveText(anuncio.titulo);
      await expect(page.getByTestId("cartel-evento-texto")).toHaveText(anuncio.explicacion);
      const quien = await page.getByTestId("cartel-evento-quien").textContent();
      if (definicion.alcance === "global") expect(quien).toBe("Todos");
      else expect(quien).not.toBe("Todos");
      expect(await cartel.evaluate((nodo) => nodo.scrollWidth <= nodo.clientWidth)).toBe(true);
      const hablado = await page.evaluate(() => window.__vozAnuncios.llamadas.filter((l) => l.tipo === "speak").map((l) => l.texto));
      expect(hablado.slice(habladasAntes).join(" ")).toContain(anuncio.explicacion);
      await expect(cartel).toHaveCount(0, { timeout: 8000 });
    }
    const dobles = await page.evaluate(() => window.__vozAnuncios.llamadas.filter((l) => l.tipo === "cancel").length);
    expect(dobles, "la cola no corta una frase para decir la siguiente").toBe(0);
  });
}

// Dos eventos en el mismo turno: el segundo cartel espera a que se vaya el primero.
test("anu-1: dos eventos seguidos se anuncian de uno en uno, cada uno al menos 4 s", async ({ page }) => {
  test.setTimeout(120000);
  await instalarDoble(page);
  await empezar(page);
  await vigilarCarteles(page);
  await page.evaluate(() => {
    window.__debug.forzarEvento!("virus", 1);
    window.__debug.forzarEvento!("tormenta", 0);
  });
  await expect(page.getByTestId("cartel-evento-titulo")).toHaveText("Virus");
  await capturar(page, "eventos-anunciados-cola-1", 360, 640);
  await expect(page.getByTestId("cartel-evento-titulo")).toHaveText("Tormenta solar", { timeout: 6000 });
  await capturar(page, "eventos-anunciados-cola-2", 360, 640);
  await expect(page.getByTestId("cartel-evento")).toHaveCount(0, { timeout: 8000 });
  const carteles = await page.evaluate(() => window.__cartelesVistos);
  expect(carteles.map((c) => c.titulo)).toEqual(["Virus", "Tormenta solar"]);
  for (const c of carteles) expect(c.hasta! - c.desde).toBeGreaterThanOrEqual(3800);
  expect(carteles[1]!.desde).toBeGreaterThanOrEqual(carteles[0]!.hasta!);
  const mensajes = await page.evaluate(() => window.__debug.historico?.mensajes);
  expect(mensajes).toBeGreaterThanOrEqual(2);
});

test("anu-1: con la voz apagada hay cartel e histórico pero ningún speak", async ({ page }) => {
  test.setTimeout(90000);
  await instalarDoble(page);
  await page.addInitScript(() => window.localStorage.setItem("voz:activada", "false"));
  await empezar(page);
  const base = await page.evaluate(() => window.__vozAnuncios.llamadas.filter((l) => l.tipo === "speak" && (l.texto ?? "") !== "").length);
  await page.evaluate(() => window.__debug.forzarEvento!("vitaminas", 1));
  await expect(page.getByTestId("cartel-evento-titulo")).toHaveText("Vitaminas artificiales");
  expect(await page.evaluate(() => window.__vozAnuncios.llamadas.filter((l) => l.tipo === "speak" && (l.texto ?? "") !== "").length)).toBe(base);
  expect(await page.evaluate(() => window.__debug.historico?.mensajes)).toBeGreaterThanOrEqual(1);
});

// anu-2: el drenaje de la muerte súbita también se anuncia, con su daño.
test("anu-2: el primer drenaje de la muerte súbita se anuncia con su daño", async ({ page }) => {
  test.setTimeout(180000);
  await empezar(page);
  await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 13, integridades: [100, 100] }));
  await page.getByTestId("disparar").click();
  await expect(page.getByTestId("cartel-evento-titulo")).toHaveText("Muerte súbita", { timeout: 90000 });
  await expect(page.getByTestId("cartel-evento-texto")).toContainText("Todos pierden 4 de vida");
  await capturar(page, "eventos-anunciados-muerte-subita", 360, 640);
});
