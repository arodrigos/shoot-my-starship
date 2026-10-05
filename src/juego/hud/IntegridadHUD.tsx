"use client";

import { useSyncExternalStore } from "react";
import { obtenerIntegridad, suscribirIntegridad } from "@/juego/control/integridadStore";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";
import { obtenerParticipantes, suscribirParticipantes } from "@/juego/control/participantesStore";

// imp-11: hasta este bloque no existía NINGÚN indicador de integridad en el
// HUD -- lo único que la reflejaba era el alfa del casco de la nave dentro
// del lienzo (Nave.ts), que no comunica ninguna cantidad ni es accesible.
// Barra con rol de progreso real (role=progressbar, aria-valuenow) para que
// un disparo que reduce integridad sea un hecho comprobable desde fuera del
// estado de depuración, no solo desde window.__debug.
// hud-canales-1: etiqueta por función, no por Record<0|1,string> -- el
// núcleo sigue teniendo solo dos naves hasta nucleo-n-naves, pero esta
// función ya no asume que `id` no pueda ser 2 o 3 (el hallazgo del
// gatekeeper era justo que una tercera nave no compilaba aquí).
function etiquetaDeNave(id: number, nombreRival: string): string {
  if (id === 0) return "Tu nave";
  if (id === 1) return nombreRival;
  return `Nave ${id + 1}`;
}

// hud-canales-1: ancho flexible (no 76px fijo) para que hasta cuatro barras
// se repartan el mismo hueco sin desbordarlo -- con 76px fijos, dos naves ya
// agotaban los ~156px disponibles en 360x640 y una tercera no cabía ni de
// casualidad (hallazgo del gatekeeper: harían falta 316px para cuatro).
const BARRA_ESTILO: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  borderRadius: 10,
  padding: "4px 6px",
  font: "12px system-ui, sans-serif",
  boxSizing: "border-box",
};

// hud-canales-1: el turno y el nombre del rival viven aquí (no en una fila
// nueva) porque esta fila ya agotaba casi todo el ancho y alto disponibles
// en 360x640 (338 de 344px, lay-5) -- resaltar la nave de quien juega y
// sustituir la etiqueta genérica por estado.nombreRival cuesta cero alto y
// cero ancho nuevos, a diferencia de una fila de turnos aparte.
export function IntegridadHUD() {
  const estado = useSyncExternalStore(suscribirIntegridad, obtenerIntegridad, obtenerIntegridad);
  const control = useSyncExternalStore(suscribirControl, obtenerEstadoControl, obtenerEstadoControl);
  // multi-setup-partida: con jugadores configurados, el nombre de cada
  // asiento sustituye a las etiquetas de la partida de siempre.
  const { participantes } = useSyncExternalStore(suscribirParticipantes, obtenerParticipantes, obtenerParticipantes);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 4,
        width: "100%",
        minWidth: 0,
      }}
    >
      {estado.naves.map((nave) => {
        const valor = Math.max(0, Math.min(100, Math.round(nave.integridad)));
        const esTurno = control.turno === nave.id;
        const etiqueta = participantes?.[nave.id]?.nombre ?? etiquetaDeNave(nave.id, control.nombreRival);
        const eliminada = participantes !== null && nave.integridad <= 0;
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
            title={eliminada ? `${etiqueta}: eliminada` : esTurno ? `${etiqueta}: turno` : etiqueta}
            aria-current={esTurno ? "true" : undefined}
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {/* Con varios jugadores el estado va DELANTE del nombre: con cuatro
                  barras en 360 px el nombre largo se corta con puntos suspensivos y
                  un sufijo "turno" se perdería justo cuando más hace falta. */}
              {participantes ? (eliminada ? "✖ " : esTurno ? "▶ " : "") : ""}
              {etiqueta}
              {participantes ? "" : esTurno ? " · turno" : ""}
            </div>
            <div
              role="progressbar"
              aria-label={`Integridad de ${etiqueta}`}
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
