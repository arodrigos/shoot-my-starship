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
        // lay-3: mismo reparto por flex que BromaHUD (ver su comentario) en
        // vez de un 48% fijo, y el mismo tope de alto -- panel-roce vive en
        // la misma fila-avisos de altura fija y sin él podía crecer más que
        // el hueco reservado exactamente por el mismo motivo que la broma.
        flex: "1 1 0",
        minWidth: 0,
        maxHeight: 70,
        overflowY: "auto",
        // con-3 (gatekeeper, iteración 6): fondo opaco propio en vez de la
        // rgba con alfa 0,16 que llevaba antes -- con transparencia el
        // contraste real depende de qué haya detrás (globals.css lo prohíbe
        // para el cromado desde esp-5, y este panel se saltaba esa regla).
        background: "var(--color-roce-fondo)",
        border: "1px solid var(--color-roce-borde)",
        borderRadius: 10,
        padding: "6px 10px",
        color: "var(--color-roce-texto)",
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
