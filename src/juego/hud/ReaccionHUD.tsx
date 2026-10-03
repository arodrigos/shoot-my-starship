"use client";

import { useEffect, useSyncExternalStore } from "react";
import { limpiarReaccion, obtenerReaccion, solicitarRepeticion, suscribirReaccion } from "@/juego/control/reaccion";

// Cuánto tiempo queda visible una reacción antes de desaparecer sola --
// bastante para leerla, poco para que estorbe al siguiente disparo.
const DURACION_VISIBLE_MS = 2600;

// Banner de texto de los siete eventos de humor (humor-1): vive fuera del
// lienzo, igual que ControlHUD, porque es una cáscara de presentación sin
// nada que saber del terreno. El auto-ocultado usa `clave` (no `texto`) como
// dependencia del efecto: dos eventos consecutivos con la misma frase deben
// reiniciar el temporizador igualmente.
export function ReaccionHUD() {
  const estado = useSyncExternalStore(suscribirReaccion, obtenerReaccion, obtenerReaccion);

  useEffect(() => {
    if (estado.clave === 0) return;
    const temporizador = window.setTimeout(limpiarReaccion, DURACION_VISIBLE_MS);
    return () => window.clearTimeout(temporizador);
  }, [estado.clave]);

  if (!estado.texto) return null;

  return (
    <div
      data-testid="reaccion-texto"
      data-tipo-evento={estado.tipoEvento ?? undefined}
      role="status"
      style={{
        // layout-dos-zonas: vive dentro de la consola (no del viewport
        // entero) para no poder solapar nunca el lienzo -- ver PhaserGame,
        // que la monta como hija de #consola (position:relative).
        position: "absolute",
        top: 2,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 15,
        background: "rgba(10,12,20,0.78)",
        color: "#ffe08a",
        borderRadius: 10,
        padding: "8px 14px",
        font: "13px system-ui, sans-serif",
        textAlign: "center",
        maxWidth: 320,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>{estado.texto}</span>
      <button
        type="button"
        data-testid="reaccion-repetir"
        onClick={solicitarRepeticion}
        style={{
          pointerEvents: "auto",
          minHeight: 24,
          padding: "2px 8px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(30,34,46,0.9)",
          color: "#e8eaf0",
          font: "12px system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        ↻ repetir
      </button>
    </div>
  );
}
