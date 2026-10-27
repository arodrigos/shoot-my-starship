import type { BrowserContext, Page } from "@playwright/test";

export type ModoVibracionFalsa = "con-api" | "sin-api" | "rechaza";

declare global {
  interface Window {
    __vibracionesFalsas?: Array<{ patron: number[]; t: number }>;
  }
}

// Doble de navigator.vibrate: Playwright no simula el motor del móvil, así que
// los e2e ven lo que el juego pide, no lo que el dispositivo hace. Se instala
// antes de cargar la página. 'sin-api' borra vibrate (como Safari de iOS) y
// 'rechaza' devuelve false (como un navegador sin activación del usuario).
export async function instalarVibracionFalsa(contexto: BrowserContext | Page, modo: ModoVibracionFalsa): Promise<void> {
  await contexto.addInitScript((modoInicial) => {
    window.__vibracionesFalsas = [];
    if (modoInicial === "sin-api") {
      Object.defineProperty(Navigator.prototype, "vibrate", { value: undefined, configurable: true });
      return;
    }
    Object.defineProperty(Navigator.prototype, "vibrate", {
      configurable: true,
      writable: true,
      value(patron: number | number[]) {
        window.__vibracionesFalsas!.push({ patron: Array.isArray(patron) ? [...patron] : [patron], t: performance.now() });
        return modoInicial === "con-api";
      },
    });
  }, modo);
}

export async function leerVibracionesFalsas(page: Page): Promise<ReadonlyArray<{ patron: number[]; t: number }>> {
  return page.evaluate(() => window.__vibracionesFalsas ?? []);
}
