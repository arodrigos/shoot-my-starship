import "@/debug/tipos";
import { despacharPwa, obtenerDatosPwa, versionApp } from "@/juego/pwa/estadoPwa";

const TOPE_ESPERA_MS = 15_000;

// Gancho de pruebas: instala de verdad un service worker nuevo (otra URL del
// mismo script) que queda en espera, para probar el aviso real sin esperar a
// un despliegue. Nunca recarga la página por sí mismo.
async function forzarVersionNueva(): Promise<void> {
  if (!("serviceWorker" in navigator) || !(await navigator.serviceWorker.getRegistration())) {
    throw new Error("No hay service worker: el aviso de versión nueva no se puede forzar");
  }
  const { fijarUrlForzada, registrarServiceWorker } = await import("@/juego/pwa/registroSw");
  const n = Number(window.sessionStorage.getItem("pwa:forzar") ?? "0") + 1;
  window.sessionStorage.setItem("pwa:forzar", String(n));
  const url = `/serwist/sw.js?forzar=${n}`;
  fijarUrlForzada(url);
  await registrarServiceWorker(url);
  const limite = Date.now() + TOPE_ESPERA_MS;
  while (Date.now() < limite) {
    const registro = await navigator.serviceWorker.getRegistration();
    if (registro?.waiting) return;
    await new Promise((resolver) => window.setTimeout(resolver, 100));
  }
  throw new Error("El service worker nuevo no llegó a quedar en espera");
}

// Gancho de pruebas: pasa por el mismo despachador que el ciclo real, sin
// necesitar un service worker (la portada se prueba con ellos bloqueados).
function mostrarAvisoPwa(cual: "listo" | "version"): void {
  if (cual === "listo") {
    despacharPwa({ tipo: "instalado", esActualizacion: false });
  } else {
    despacharPwa({ tipo: "esperando" });
  }
}

export function publicarGanchosPwa(): void {
  window.__debug = window.__debug ?? {};
  window.__debug.pwa = {
    get estado() {
      return obtenerDatosPwa().estado;
    },
    get version() {
      return versionApp();
    },
    get controlado() {
      return "serviceWorker" in navigator && navigator.serviceWorker.controller !== null;
    },
    forzarVersionNueva,
  };
  window.__debug.mostrarAvisoPwa = mostrarAvisoPwa;
}
