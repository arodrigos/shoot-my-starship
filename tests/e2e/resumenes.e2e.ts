import { test, expect, type Page } from "@playwright/test";

interface VozDoble {
  name: string;
  lang: string;
  localService: boolean;
}

declare global {
  interface Window {
    __dobleVoz: { llamadas: Array<{ tipo: string; texto?: string; lang?: string; rate?: number; pitch?: number; voz?: string; activacion?: boolean }> };
  }
}

// voz-resumenes: speechSynthesis se sustituye por un doble que registra cada
// cancel y cada speak (con el estado de activación del usuario en ese
// instante) y emite start y end sin hablar de verdad, así el test es
// determinista y no depende de las voces del Chromium del CI.
async function instalarDoble(page: Page, voces: VozDoble[]): Promise<void> {
  await page.addInitScript((lista) => {
    const llamadas: Window["__dobleVoz"]["llamadas"] = [];
    window.__dobleVoz = { llamadas };
    class Utterance extends EventTarget {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: unknown = null;
      voiceURI = "";
      constructor(texto = "") {
        super();
        this.text = texto;
      }
    }
    const sintesis = {
      onvoiceschanged: null as null | (() => void),
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => lista,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      cancel: () => {
        llamadas.push({ tipo: "cancel" });
      },
      pause: () => undefined,
      resume: () => undefined,
      speak: (u: Utterance) => {
        llamadas.push({
          tipo: "speak",
          texto: u.text,
          lang: u.lang,
          rate: u.rate,
          pitch: u.pitch,
          voz: (u.voice as { name?: string } | null)?.name,
          activacion: navigator.userActivation.isActive,
        });
        setTimeout(() => {
          u.dispatchEvent(new Event("start"));
          u.dispatchEvent(new Event("end"));
        }, 20);
      },
    };
    Object.defineProperty(window, "speechSynthesis", { value: sintesis, configurable: true });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
  }, voces);
}

const ES_ES: VozDoble = { name: "Voz ES", lang: "es-ES", localService: true };
const EN_US: VozDoble = { name: "Voice EN", lang: "en-US", localService: true };

async function empezar(page: Page): Promise<void> {
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.voz !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

const habladas = (page: Page) =>
  page.evaluate(() => window.__dobleVoz.llamadas.filter((llamada) => llamada.tipo === "speak" && (llamada.texto ?? "") !== ""));

// Juega N turnos resueltos (de cualquier asiento) y espera a que el registro
// los cuente, sin esperas fijas.
async function jugarTurnos(page: Page, cuantos: number): Promise<void> {
  const antes = await page.evaluate(() => window.__debug.historialBromas?.length ?? 0);
  await page.evaluate((n) => window.__debug.jugarTurnosGuionizados!(n), cuantos);
  await page.waitForFunction(([base, n]) => (window.__debug.historialBromas?.length ?? 0) >= base + n, [antes, cuantos] as const);
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

// res-v1 y res-v2 (camino crítico): ningún chiste por disparo, y al tercer
// turno un resumen que se lee a velocidad normal, sin cancelar nada.
for (const { ancho, alto } of TAMANOS) {
  test(`res-v1: a ${ancho}x${alto} no hay chiste en los turnos 1 y 2 y el tercero trae un resumen hablado`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: ancho, height: alto });
    await instalarDoble(page, [EN_US, ES_ES]);
    await empezar(page);

    const todas = await page.evaluate(() => window.__dobleVoz.llamadas);
    const desbloqueo = todas.find((llamada) => llamada.tipo === "speak");
    expect(desbloqueo?.activacion, "el primer speak ocurre dentro del gesto de Jugar").toBe(true);
    const base = (await habladas(page)).length;

    for (const turno of [1, 2]) {
      await jugarTurnos(page, 1);
      await expect(page.getByTestId("resumen-texto")).toHaveCount(0);
      expect(await habladas(page)).toHaveLength(base);
      await capturar(page, `voz-resumenes-turno${turno}`, ancho, alto);
    }
    await jugarTurnos(page, 1);
    const resumen = page.getByTestId("resumen-texto");
    await expect(resumen).toBeVisible();
    await capturar(page, "voz-resumenes-turno3", ancho, alto);

    const historial = await page.evaluate(() => window.__debug.historialBromas!);
    const texto = historial.at(-1)!.resumen;
    expect(texto).not.toBeNull();
    expect(texto!.length).toBeLessThanOrEqual(140);
    await expect(resumen).toHaveText(texto!);

    const llamadas = await page.evaluate(() => window.__dobleVoz.llamadas);
    const dichas = llamadas.filter((l) => l.tipo === "speak" && (l.texto ?? "") !== "");
    expect(dichas.slice(base).map((l) => l.texto)).toEqual([texto]);
    const hablada = dichas.at(-1)!;
    expect(hablada.lang).toBe("es-ES");
    expect(hablada.voz).toBe("Voz ES");
    expect(hablada.rate).toBeLessThanOrEqual(1);
    expect(hablada.rate).toBeGreaterThanOrEqual(0.9);
    expect(llamadas.filter((l) => l.tipo === "cancel")).toHaveLength(0);
  });
}

test("res-v1: el resumen se queda en pantalla al menos max(6000, 70 × caracteres) ms", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 360, height: 640 });
  await instalarDoble(page, [ES_ES]);
  await empezar(page);
  await jugarTurnos(page, 3);
  const resumen = page.getByTestId("resumen-texto");
  await expect(resumen).toBeVisible();
  const longitud = (await resumen.textContent())!.length;
  const inicio = Date.now();
  await expect(resumen).toBeHidden({ timeout: 20000 });
  expect(Date.now() - inicio).toBeGreaterThanOrEqual(Math.max(6000, 70 * longitud) - 500);
});

test("res-v1: con 6 turnos salen 2 resúmenes con plantillas distintas", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 360, height: 640 });
  await instalarDoble(page, [ES_ES]);
  await empezar(page);
  await jugarTurnos(page, 6);
  const historial = await page.evaluate(() => window.__debug.historialBromas!);
  const resumenes = historial.map((e) => e.resumen).filter((t): t is string => t !== null);
  expect(resumenes).toHaveLength(2);
  expect(resumenes[0]).not.toBe(resumenes[1]);
});

// voz-2 (camino crítico).
test("voz-2: el interruptor silencia, se recuerda al recargar y no toca la música", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 820, height: 1180 });
  await instalarDoble(page, [ES_ES]);
  await empezar(page);
  const musicaAntes = await page.evaluate(() => window.__debug.musica!().estado);

  const interruptor = page.getByTestId("toggle-voz");
  await expect(interruptor).toHaveAttribute("aria-pressed", "true");
  await interruptor.click();
  await expect(interruptor).toHaveAttribute("aria-pressed", "false");
  await expect(interruptor).toHaveText("Voz: Off");
  expect(await page.evaluate(() => window.localStorage.getItem("voz:activada"))).toBe("false");
  expect(await page.evaluate(() => window.__debug.musica!().estado)).toBe(musicaAntes);

  await jugarTurnos(page, 3);
  expect(await habladas(page)).toEqual([]);

  await page.reload();
  await empezar(page);
  await jugarTurnos(page, 3);
  expect(await habladas(page)).toEqual([]);
  await expect(page.getByTestId("toggle-voz")).toHaveAttribute("aria-pressed", "false");
});

// voz-3.
test("voz-3: sin voz es local no habla, avisa una vez y deshabilita el interruptor", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 360, height: 640 });
  await instalarDoble(page, [EN_US, { name: "Google español", lang: "es-ES", localService: false }]);
  await empezar(page);
  await expect(page.getByTestId("toggle-voz")).toBeDisabled();
  await expect(page.getByTestId("voz-aviso")).toHaveText(
    "Tu dispositivo no tiene voz en castellano: los resúmenes seguirán en texto",
  );
  await jugarTurnos(page, 3);
  expect(await habladas(page)).toEqual([]);
  await expect(page.getByTestId("voz-aviso")).toHaveCount(1);
});
