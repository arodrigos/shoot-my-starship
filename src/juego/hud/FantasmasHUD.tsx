"use client";

import { useSyncExternalStore } from "react";
import { obtenerFantasmas, suscribirFantasmas } from "@/juego/control/fantasmasStore";

// desplazamiento-tras-impacto (des-3): un aviso por nave desplazada durante el
// turno siguiente, para que quien juega sepa que la marca del lienzo es el
// sitio donde estaba y no una nave más.
export function FantasmasHUD() {
  const fantasmas = useSyncExternalStore(suscribirFantasmas, obtenerFantasmas, obtenerFantasmas);
  if (fantasmas.length === 0) return null;
  return (
    <>
      {fantasmas.map((fantasma) => (
        <div
          key={fantasma.nave}
          data-testid={`fantasma-${fantasma.nave}`}
          role="status"
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--color-roce-fondo)",
            border: "1px solid var(--color-roce-borde)",
            borderRadius: 10,
            padding: "4px 10px",
            color: "var(--color-roce-texto)",
            font: "12px system-ui, sans-serif",
            pointerEvents: "none",
            flexShrink: 0,
          }}
        >
          {fantasma.texto}
        </div>
      ))}
    </>
  );
}
