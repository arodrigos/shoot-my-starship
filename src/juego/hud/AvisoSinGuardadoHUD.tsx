"use client";

import { useSyncExternalStore } from "react";
import { avisoSinGuardadoVisible, suscribirAvisoSinGuardado } from "@/juego/control/avisoSinGuardadoStore";

export function AvisoSinGuardadoHUD() {
  const visible = useSyncExternalStore(suscribirAvisoSinGuardado, avisoSinGuardadoVisible, () => false);
  if (!visible) return null;
  return (
    <div
      role="status"
      data-testid="aviso-sin-guardado"
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        background: "#3b2f0b",
        color: "#ffe08a",
        border: "1px solid #ffcc66",
        font: "13px system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      No se puede guardar esta partida en este dispositivo: si sales de la app, se perderá.
    </div>
  );
}
