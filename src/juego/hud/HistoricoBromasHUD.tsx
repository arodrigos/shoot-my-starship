"use client";

import { useSyncExternalStore } from "react";
import { obtenerBromas, suscribirBromas } from "@/juego/control/broma";

// hud-canales-3: histórico consultable desde el canal de estado -- la broma
// en sí es efímera (BromaHUD), pero nada de lo que ya se dijo se pierde.
export function HistoricoBromasHUD() {
  const estado = useSyncExternalStore(suscribirBromas, obtenerBromas, obtenerBromas);

  return (
    <div
      data-testid="historico-bromas"
      role="log"
      aria-label="Histórico de bromas"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxHeight: 48,
        overflowY: "auto",
        background: "var(--color-cromado-fondo)",
        borderRadius: 8,
        padding: "4px 8px",
        color: "var(--color-cromado-texto)",
        font: "12px system-ui, sans-serif",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
    >
      {estado.historico.length === 0 ? (
        <div data-testid="historico-bromas-vacio">Aún no hay mensajes en esta partida</div>
      ) : (
        estado.historico.map((entrada, indice) => (
          <div key={entrada.numeroTurno} data-testid={`historico-bromas-entrada-${indice}`}>
            {entrada.disparo ? `${entrada.disparo} ` : ""}
            {entrada.impacto}
          </div>
        ))
      )}
    </div>
  );
}
