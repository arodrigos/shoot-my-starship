import type { Page } from "@playwright/test";

export type ModoWakeLockFalso = "conceder" | "rechazar" | "sin-api";

declare global {
  interface Window {
    __wakeLockFalso?: {
      peticiones: number;
      vivos: number;
      tipos: string[];
      soltarDesdeSistema(): void;
      fijarModo(modo: "conceder" | "rechazar"): void;
      ocultarPagina(): void;
      mostrarPagina(): void;
    };
  }
}

// Doble de navigator.wakeLock: Playwright no simula el apagado de pantalla,
// así que los e2e ven lo que el juego pide y suelta, no el sistema. Se instala
// antes de cargar la página. En modo 'rechazar' el release() también lanza,
// para probar que el juego no se entera.
export async function instalarWakeLockFalso(page: Page, modo: ModoWakeLockFalso): Promise<void> {
  await page.addInitScript((modoInicial) => {
    if (modoInicial === "sin-api") {
      Object.defineProperty(navigator, "wakeLock", { value: undefined, configurable: true });
      return;
    }
    let modoActual: "conceder" | "rechazar" = modoInicial;
    const vivos = new Set<{ soltar: (desdeSistema: boolean) => void }>();
    const falso = {
      peticiones: 0,
      get vivos() {
        return vivos.size;
      },
      tipos: [] as string[],
      soltarDesdeSistema() {
        for (const s of [...vivos]) s.soltar(true);
      },
      fijarModo(m: "conceder" | "rechazar") {
        modoActual = m;
      },
      ocultarPagina() {
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      },
      mostrarPagina() {
        Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      },
    };
    // Como el navegador, suelta el bloqueo al ocultarse la página.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") for (const s of [...vivos]) s.soltar(true);
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request(tipo: string) {
          falso.peticiones++;
          falso.tipos.push(tipo);
          if (modoActual === "rechazar") return Promise.reject(new DOMException("no concedido", "NotAllowedError"));
          const escuchas: Array<() => void> = [];
          const sentinel = {
            released: false,
            type: tipo,
            addEventListener(_t: string, e: () => void) {
              escuchas.push(e);
            },
            release() {
              if (modoInicial === "rechazar") throw new Error("fallo al soltar");
              entrada.soltar(false);
              return Promise.resolve();
            },
          };
          const entrada = {
            soltar(desdeSistema: boolean) {
              if (!vivos.delete(entrada)) return;
              sentinel.released = true;
              if (desdeSistema) for (const e of escuchas) e();
            },
          };
          vivos.add(entrada);
          return Promise.resolve(sentinel);
        },
      },
    });
    window.__wakeLockFalso = falso;
  }, modo);
}
