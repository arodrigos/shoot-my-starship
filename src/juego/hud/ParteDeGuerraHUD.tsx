"use client";

import { useSyncExternalStore } from "react";
import { obtenerParteDeGuerra, solicitarOtraPartida, suscribirParteDeGuerra } from "@/juego/control/parteDeGuerraStore";

// Pantalla final (humor-7): se superpone al tablero ya congelado (la
// partida ha terminado, nadie va a disparar otra vez) mostrando la medalla y
// los números reales que la sustentan -- nunca solo el nombre de la medalla,
// que sería indistinguible de un remate fijo.
export function ParteDeGuerraHUD() {
  const { parte } = useSyncExternalStore(suscribirParteDeGuerra, obtenerParteDeGuerra, obtenerParteDeGuerra);

  if (!parte) return null;

  return (
    <div
      data-testid="parte-de-guerra"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 25,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(4,5,10,0.82)",
        color: "#e8eaf0",
        font: "14px system-ui, sans-serif",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 360 }}>
        <h2 data-testid="parte-de-guerra-medalla" style={{ color: "#ffe08a", margin: "0 0 8px" }}>
          {parte.medalla}
        </h2>
        <p data-testid="parte-de-guerra-texto">{parte.texto}</p>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px 12px",
            textAlign: "left",
            font: "12px system-ui, sans-serif",
            marginTop: 12,
          }}
        >
          <dt>Disparos</dt>
          <dd>{parte.estadisticas.disparos}</dd>
          <dt>Fallos</dt>
          <dd>{parte.estadisticas.fallos}</dd>
          <dt>Autoimpactos</dt>
          <dd>{parte.estadisticas.autoimpactos}</dd>
          <dt>Daño al enemigo</dt>
          <dd>{parte.estadisticas.danioHechoAlEnemigo}</dd>
          <dt>Píxeles destruidos</dt>
          <dd>{parte.estadisticas.pixelesDestruidos}</dd>
        </dl>
        <button
          type="button"
          data-testid="otra-partida"
          onClick={solicitarOtraPartida}
          style={{
            marginTop: 16,
            minHeight: 44,
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "#ff6b4a",
            color: "#e8eaf0",
            font: "14px system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          Otra partida
        </button>
      </div>
    </div>
  );
}
