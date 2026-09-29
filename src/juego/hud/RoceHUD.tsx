"use client";

import { useSyncExternalStore } from "react";
import { obtenerRoce, suscribirRoce } from "@/juego/control/roceStore";

// contacto-honesto (con-3, con-6): panel propio para el mensaje de roce --
// abajo a la izquierda, para no solapar ni con "resultado-turno" (arriba a
// la izquierda) ni con "panel-bromas" (abajo, centrado). No se autooculta
// con temporizador (mismo motivo que BromaHUD): con-3 exige que se anuncie
// "en pantalla", no en un aviso que pueda desaparecer antes de leerse.
export function RoceHUD() {
  const estado = useSyncExternalStore(suscribirRoce, obtenerRoce, obtenerRoce);

  if (!estado.texto) return null;

  return (
    <div
      data-testid="panel-roce"
      role="status"
      style={{
        maxWidth: "48%",
        background: "rgba(90,200,250,0.16)",
        border: "1px solid rgba(90,200,250,0.6)",
        borderRadius: 10,
        padding: "6px 10px",
        color: "var(--color-cromado-texto)",
        font: "11px system-ui, sans-serif",
        pointerEvents: "none",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
    >
      {estado.texto}
    </div>
  );
}
