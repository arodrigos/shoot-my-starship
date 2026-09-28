"use client";

import { useSyncExternalStore } from "react";
import { obtenerBromas, suscribirBromas } from "@/juego/control/broma";

// Panel de bromas de humor-por-turno (hum-1): dos líneas independientes
// (disparo, impacto) que sustituyen su propio texto en cada turno -- a
// diferencia de ReaccionHUD (humor-sistemico), esto NO se autooculta con un
// temporizador: hum-1 exige que "aparece una frase tras cada disparo y otra
// tras cada impacto, sin excepción", así que la última frase de cada tipo se
// queda visible hasta que la siguiente la sustituye, en vez de desaparecer
// antes de que e2e (o Adrián) llegue a leerla.
export function BromaHUD() {
  const estado = useSyncExternalStore(suscribirBromas, obtenerBromas, obtenerBromas);

  if (!estado.disparo && !estado.impacto) return null;

  return (
    <div
      data-testid="panel-bromas"
      style={{
        position: "fixed",
        bottom: 96,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 15,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "center",
        pointerEvents: "none",
        maxWidth: 340,
      }}
    >
      {estado.disparo && (
        <div
          data-testid="broma-disparo-texto"
          role="status"
          style={{
            background: "rgba(10,12,20,0.72)",
            color: "#cfe8ff",
            borderRadius: 8,
            padding: "4px 10px",
            font: "12px system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          {estado.disparo}
        </div>
      )}
      {estado.impacto && (
        <div
          data-testid="broma-impacto-texto"
          data-categoria={estado.categoriaImpacto ?? undefined}
          role="status"
          style={{
            background: "rgba(10,12,20,0.78)",
            color: "#ffe08a",
            borderRadius: 8,
            padding: "5px 12px",
            font: "13px system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          {estado.impacto}
        </div>
      )}
    </div>
  );
}
