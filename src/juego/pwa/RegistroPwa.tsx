"use client";

import { useEffect } from "react";
import { AvisosPwa } from "@/juego/pwa/AvisosPwa";
import { comprobarActualizacion } from "@/juego/pwa/ciclo";
import { despacharPwa } from "@/juego/pwa/estadoPwa";
import { publicarGanchosPwa } from "@/juego/pwa/ganchosPwa";
import { desinstalar, registrarServiceWorker, serviceWorkerActual, urlServiceWorker } from "@/juego/pwa/registroSw";

const COMPROBAR_CADA_MS = 30 * 60 * 1000;

function cuandoHayHueco(tarea: () => void): void {
  const lanzar = (): void => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(tarea);
    else window.setTimeout(tarea, 1);
  };
  if (document.readyState === "complete") lanzar();
  else window.addEventListener("load", lanzar, { once: true });
}

export function RegistroPwa() {
  useEffect(() => {
    publicarGanchosPwa();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if (new URLSearchParams(window.location.search).get("sw") === "0") {
      void desinstalar();
      return;
    }
    let cancelado = false;
    const entorno = { enLinea: () => navigator.onLine, almacenamiento: navigator.storage, recargar: () => undefined };
    const comprobar = (): void => {
      const sw = serviceWorkerActual();
      if (sw) void comprobarActualizacion(sw, entorno);
    };
    const alVolver = (): void => {
      if (document.visibilityState === "visible") comprobar();
    };
    const temporizador = window.setInterval(comprobar, COMPROBAR_CADA_MS);
    document.addEventListener("visibilitychange", alVolver);
    cuandoHayHueco(() => {
      if (cancelado) return;
      despacharPwa({ tipo: "registrando" });
      registrarServiceWorker(urlServiceWorker()).catch(() => despacharPwa({ tipo: "registro-fallido" }));
    });
    return () => {
      cancelado = true;
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  return <AvisosPwa />;
}
