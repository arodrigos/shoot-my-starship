"use client";

import { useSyncExternalStore } from "react";
import type { IdNave } from "@/sim/partida/tipos";
import { obtenerIntegridad, suscribirIntegridad } from "@/juego/control/integridadStore";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";

// imp-11: hasta este bloque no existía NINGÚN indicador de integridad en el
// HUD -- lo único que la reflejaba era el alfa del casco de la nave dentro
// del lienzo (Nave.ts), que no comunica ninguna cantidad ni es accesible.
// Barra con rol de progreso real (role=progressbar, aria-valuenow) para que
// un disparo que reduce integridad sea un hecho comprobable desde fuera del
// estado de depuración, no solo desde window.__debug.
const ETIQUETA_POR_NAVE: Record<0 | 1, string> = {
  0: "Tu nave",
  1: "Rival",
};

const BARRA_ESTILO: React.CSSProperties = {
  width: 76,
  borderRadius: 10,
  padding: "4px 8px",
  font: "10px system-ui, sans-serif",
};

// hud-canales-1: el turno y el nombre del rival viven aquí (no en una fila
// nueva) porque esta fila ya agotaba casi todo el ancho y alto disponibles
// en 360x640 (338 de 344px, lay-5) -- resaltar la nave de quien juega y
// sustituir la etiqueta genérica por estado.nombreRival cuesta cero alto y
// cero ancho nuevos, a diferencia de una fila de turnos aparte.
export function IntegridadHUD() {
  const estado = useSyncExternalStore(suscribirIntegridad, obtenerIntegridad, obtenerIntegridad);
  const control = useSyncExternalStore(suscribirControl, obtenerEstadoControl, obtenerEstadoControl);

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
        const esTurno = control.turno === (nave.id as IdNave);
        const etiqueta = nave.id === 1 ? control.nombreRival : ETIQUETA_POR_NAVE[nave.id];
        return (
          <div
            key={nave.id}
            style={{
              ...BARRA_ESTILO,
              background: esTurno ? "var(--color-roce-fondo)" : "var(--color-cromado-fondo)",
              color: esTurno ? "var(--color-roce-texto)" : "var(--color-cromado-texto)",
              border: esTurno ? "1px solid var(--color-roce-borde)" : "1px solid transparent",
            }}
            data-testid={`integridad-nave-${nave.id}`}
            aria-current={esTurno ? "true" : undefined}
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {etiqueta}
              {esTurno ? " · turno" : ""}
            </div>
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
