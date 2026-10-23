"use client";

import { useSyncExternalStore } from "react";
import { obtenerRelojTurno, suscribirRelojTurno } from "@/juego/control/relojTurnoStore";
import { tamTexto } from "@/juego/hud/legibilidad";

const ULTIMOS_SEGUNDOS_AMBAR = 10;

function movimientoReducido(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Píldora sobre la esquina de la pestaña del jugador activo. Colores fijos con
// contraste propio: la pestaña cambia de fondo con el tema. No usa el círculo
// de CuentaAtrasHUD, que es de la espoleta y solo vive durante el vuelo.
export function PildoraRelojTurno() {
  const reloj = useSyncExternalStore(suscribirRelojTurno, obtenerRelojTurno, obtenerRelojTurno);
  if (reloj.configuradoS === null || (reloj.estado !== "corriendo" && reloj.estado !== "pausado")) return null;
  const segundos = Math.max(0, Math.ceil(reloj.restanteMs / 1000));
  const urgente = segundos <= ULTIMOS_SEGUNDOS_AMBAR;
  const late = urgente && !movimientoReducido();
  return (
    <>
      <style>{`@keyframes reloj-turno-pulso{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}`}</style>
      <span
        data-testid="reloj-turno"
        data-urgente={urgente ? "true" : "false"}
        role="timer"
        aria-label={`Quedan ${segundos} segundos`}
        style={{
          position: "absolute",
          top: -13,
          right: 4,
          minWidth: 22,
          padding: "0 6px",
          borderRadius: 10,
          boxSizing: "border-box",
          background: urgente ? "#ffb020" : "#0b0f1a",
          color: urgente ? "#1a1000" : "#ffffff",
          border: urgente ? "1px solid #1a1000" : "1px solid #ffffff",
          font: `bold ${tamTexto(14)} system-ui, sans-serif`,
          lineHeight: 1.3,
          textAlign: "center",
          pointerEvents: "none",
          animation: late ? "reloj-turno-pulso 1s ease-in-out infinite" : "none",
        }}
      >
        {segundos}
      </span>
    </>
  );
}

export function AvisoTiempoAgotadoHUD() {
  const reloj = useSyncExternalStore(suscribirRelojTurno, obtenerRelojTurno, obtenerRelojTurno);
  if (!reloj.aviso) return null;
  return (
    <div
      data-testid="aviso-tiempo-agotado"
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        background: "#8a2c14",
        color: "#ffffff",
        border: "2px solid #ffcc66",
        font: `bold ${tamTexto(14)} system-ui, sans-serif`,
        textAlign: "center",
      }}
    >
      ¡Tiempo! Disparo automático
    </div>
  );
}
