"use client";

import { useSyncExternalStore } from "react";
import { obtenerIntegridad, suscribirIntegridad } from "@/juego/control/integridadStore";

// imp-11: hasta este bloque no existía NINGÚN indicador de integridad en el
// HUD -- lo único que la reflejaba era el alfa del casco de la nave dentro
// del lienzo (Nave.ts), que no comunica ninguna cantidad ni es accesible.
// Barra con rol de progreso real (role=progressbar, aria-valuenow) para que
// un disparo que reduce integridad sea un hecho comprobable desde fuera del
// estado de depuración, no solo desde window.__debug.
const ETIQUETA_POR_NAVE: Record<0 | 1, string> = {
  0: "Tu nave",
  1: "Nave rival",
};

const BARRA_ESTILO: React.CSSProperties = {
  width: 76,
  background: "var(--color-cromado-fondo)",
  borderRadius: 10,
  padding: "4px 8px",
  color: "var(--color-cromado-texto)",
  font: "10px system-ui, sans-serif",
};

export function IntegridadHUD() {
  const estado = useSyncExternalStore(suscribirIntegridad, obtenerIntegridad, obtenerIntegridad);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 4,
      }}
    >
      {estado.naves.map((nave) => {
        const valor = Math.max(0, Math.min(100, Math.round(nave.integridad)));
        return (
          <div key={nave.id} style={BARRA_ESTILO} data-testid={`integridad-nave-${nave.id}`}>
            <div>{ETIQUETA_POR_NAVE[nave.id]}</div>
            <div
              role="progressbar"
              aria-label={`Integridad de ${ETIQUETA_POR_NAVE[nave.id]}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={valor}
              style={{
                marginTop: 4,
                height: 8,
                borderRadius: 4,
                background: "rgba(255,255,255,0.15)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${valor}%`,
                  height: "100%",
                  background: valor > 30 ? "#5ac8fa" : "#ff6b4a",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
