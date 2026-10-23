"use client";

import { useSyncExternalStore } from "react";
import { cerrarAyudaApuntado, obtenerEstadoControl, suscribirControl } from "@/juego/control/store";
import { tamTexto } from "@/juego/hud/legibilidad";

// apuntado-360: el dedo gira alrededor de la nave y la flecha lo sigue;
// alejarlo o acercarlo cambia la fuerza.
export const TEXTO_AYUDA_APUNTADO = "Gira el dedo alrededor de tu nave para apuntar; aléjalo para más fuerza";

// apuntado-y-relevo (apu-6): una línea sobre el lienzo, no dentro de la
// consola, porque a 360x640 la consola ya no tiene un píxel libre.
export function AyudaApuntadoHUD() {
  const visible = useSyncExternalStore(
    suscribirControl,
    // Con el panel de ayuda inicial abierto se espera: ambas capas ocupaban
    // la misma zona y la del gesto tapaba líneas del primer párrafo.
    () => obtenerEstadoControl().ayudaApuntadoVisible && obtenerEstadoControl().puedeDisparar && !obtenerEstadoControl().ayudaVisible,
    () => false,
  );
  if (!visible) return null;
  return (
    <div
      data-testid="ayuda-apuntado"
      role="status"
      style={{
        // Vive en CapaAvisosHUD (flujo en columna): con posición propia se
        // pisaba con los demás avisos y con el rótulo de la deriva.
        width: "100%",
        // Solo el botón de cerrar captura toques: el resto no debe impedir
        // apuntar a través de la ayuda.
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: "#101a33",
        border: "1px solid #3b5aa8",
        borderRadius: 10,
        color: "#e8eefc",
        font: `${tamTexto(14)} system-ui, sans-serif`,
        boxSizing: "border-box",
      }}
    >
      <span style={{ flex: 1 }}>{TEXTO_AYUDA_APUNTADO}</span>
      <button
        type="button"
        data-testid="ayuda-apuntado-cerrar"
        aria-label="Cerrar ayuda de apuntado"
        onClick={cerrarAyudaApuntado}
        style={{ pointerEvents: "auto", font: "inherit", minWidth: 44, minHeight: 44, background: "transparent", color: "inherit", border: "1px solid #3b5aa8", borderRadius: 8 }}
      >
        ✕
      </button>
    </div>
  );
}
