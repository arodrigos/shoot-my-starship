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

// voz-chistes: speechSynthesis se sustituye por un doble que registra cada
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

async function jugarUnTurno(page: Page): Promise<void> {
  await page.evaluate(() => window.__debug.dispararRafagaTurbo!(1));
  await page.waitForFunction(() => (window.__debug.historialBromas?.length ?? 0) >= 1);
}

// voz-1 (camino crítico).
test("voz-1: con la voz activada la broma se lee en es-ES con el timbre del personaje, tras un cancel", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 360, height: 640 });
  await instalarDoble(page, [EN_US, ES_ES]);
  await empezar(page);

  const todas = await page.evaluate(() => window.__dobleVoz.llamadas);
  const desbloqueo = todas.find((llamada) => llamada.tipo === "speak");
  expect(desbloqueo?.activacion, "el primer speak ocurre dentro del gesto de Jugar").toBe(true);

  await jugarUnTurno(page);
  const bromas = await page.evaluate(() => window.__debug.historialBromas!);
  const broma = bromas[0];
  const esperado = [broma.textoDisparo, broma.textoImpacto].filter((t) => t !== null).join(" ");
  await expect.poll(async () => (await habladas(page)).map((l) => l.texto)).toContain(esperado);

  const llamadas = await page.evaluate(() => window.__dobleVoz.llamadas);
  const indice = llamadas.findIndex((llamada) => llamada.tipo === "speak" && llamada.texto === esperado);
  expect(llamadas[indice - 1].tipo).toBe("cancel");
  expect(llamadas[indice].lang).toBe("es-ES");
  expect(llamadas[indice].voz).toBe("Voz ES");
  // Almirante Bisagra no es el personaje de esta partida: se contrasta con la
  // tabla de timbres de su voz (la del tirador).
  const timbres: Record<string, { rate: number; pitch: number }> = {
    "la-contable": { rate: 0.92, pitch: 0.85 },
    "almirante-bisagra": { rate: 0.98, pitch: 0.95 },
    chispa: { rate: 1.15, pitch: 1.35 },
  };
  expect(llamadas[indice].rate).toBeCloseTo(timbres[broma.voz].rate, 5);
  expect(llamadas[indice].pitch).toBeCloseTo(timbres[broma.voz].pitch, 5);
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

  await jugarUnTurno(page);
  expect(await habladas(page)).toEqual([]);

  await page.reload();
  await empezar(page);
  await jugarUnTurno(page);
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
    "Tu dispositivo no tiene voz en castellano: los chistes seguirán en texto",
  );
  await jugarUnTurno(page);
  expect(await habladas(page)).toEqual([]);
  await expect(page.getByTestId("voz-aviso")).toHaveCount(1);
});
