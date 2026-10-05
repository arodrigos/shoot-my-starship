"use client";

import { useSyncExternalStore } from "react";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";

// apuntado-y-relevo (apu-4): colocar 3-4 naves tarda de 4 a 9 s y bloquea el
// hilo principal, así que sin un aviso la pantalla parece colgada. Se pinta
// desde el montaje y lo retira la escena al terminar de colocar.
export function PreparandoHUD() {
  const preparando = useSyncExternalStore(suscribirControl, () => obtenerEstadoControl().preparando, () => true);
  if (!preparando) return null;
  return (
    <div
      data-testid="preparando"
      role="status"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#05060f",
        color: "#e8eefc",
        font: "16px system-ui, sans-serif",
      }}
    >
      Preparando el sistema…
    </div>
  );
}
