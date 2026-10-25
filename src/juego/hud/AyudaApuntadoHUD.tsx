"use client";

import { useSyncExternalStore } from "react";
import { cerrarAyudaApuntado, obtenerEstadoControl, suscribirControl } from "@/juego/control/store";
import { tamTexto } from "@/juego/hud/legibilidad";

// apuntado-360: el dedo gira alrededor de la nave y la flecha lo sigue;
// alejarlo o acercarlo cambia la fuerza.
export const TEXTO_AYUDA_APUNTADO = "Gira el dedo alrededor de tu nave para apuntar; aléjalo para más fuerza";

// av-1 (#312): vive en la zona de la consola (encima de sus controles, o de la
// pestaña si está oculta), no en la capa de avisos: la cámara aparta las naves
// de esa zona y el ✕ de 44x44 no se queda con el toque que iba a una nave.
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
        width: "100%",
        flexShrink: 0,
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
