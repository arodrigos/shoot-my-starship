"use client";

import { useSyncExternalStore } from "react";
import { cerrarAyudaApuntado, obtenerEstadoControl, suscribirControl } from "@/juego/control/store";

// apuntado-y-relevo (apu-6): una línea sobre el lienzo, no dentro de la
// consola, porque a 360x640 la consola ya no tiene un píxel libre.
export function AyudaApuntadoHUD() {
  const visible = useSyncExternalStore(
    suscribirControl,
    () => obtenerEstadoControl().ayudaApuntadoVisible && obtenerEstadoControl().puedeDisparar,
    () => false,
  );
  if (!visible) return null;
  return (
    <div
      data-testid="ayuda-apuntado"
      role="status"
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        top: 108,
        // Solo el botón de cerrar captura toques: el resto no debe impedir
        // apuntar a través de la ayuda.
        pointerEvents: "none",
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: "#101a33",
        border: "1px solid #3b5aa8",
        borderRadius: 10,
        color: "#e8eefc",
        font: "12px system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <span style={{ flex: 1 }}>Arrastra desde tu nave hacia donde quieras disparar: más lejos, más fuerte</span>
      <button
        type="button"
        data-testid="ayuda-apuntado-cerrar"
        aria-label="Cerrar ayuda de apuntado"
        onClick={cerrarAyudaApuntado}
        style={{ pointerEvents: "auto", minWidth: 44, minHeight: 44, background: "transparent", color: "inherit", border: "1px solid #3b5aa8", borderRadius: 8 }}
      >
        ✕
      </button>
    </div>
  );
}
