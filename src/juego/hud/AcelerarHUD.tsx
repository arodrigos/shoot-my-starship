"use client";

import { useRef, useSyncExternalStore } from "react";
import "@/debug/tipos";
import { tamTexto } from "@/juego/hud/legibilidad";
import { useZonaOcupada } from "@/juego/hud/useZonaOcupada";
import { acelerarHastaImpacto, obtenerEstadoPresentacion, suscribirVelocidadPresentacion } from "@/juego/vuelo/velocidadPresentacion";

const LADO_BOTON_PX = 48;

// «⏩» mientras vuela un proyectil o juega la IA; tras el toque pasa a «×3».
// Fuera de esas fases no existe en el DOM, así que no estorba al apuntar.
export function AcelerarHUD() {
  const estado = useSyncExternalStore(suscribirVelocidadPresentacion, obtenerEstadoPresentacion, obtenerEstadoPresentacion);
  return estado.botonVisible ? <BotonAcelerar triple={estado.factor === 3} /> : null;
}

// Componente aparte para que la zona ocupada se enganche al montarse el botón
// (useZonaOcupada observa el elemento una sola vez) y se suelte al quitarse.
function BotonAcelerar({ triple }: { readonly triple: boolean }) {
  const boton = useRef<HTMLButtonElement>(null);
  useZonaOcupada("acelerar", boton, true);
  return (
    <button
      ref={boton}
      type="button"
      data-testid="boton-acelerar"
      data-zona-hud=""
      aria-label={triple ? "Velocidad triple activa" : "Acelerar hasta el impacto"}
      // onPointerDown y no onClick: la latencia se mide desde el contacto.
      onPointerDown={() => acelerarHastaImpacto()}
      // Teclado: un click sin puntero (detail 0) no pasa por onPointerDown.
      onClick={(evento) => {
        if (evento.detail === 0) acelerarHastaImpacto();
      }}
      style={{
        position: "fixed",
        bottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        right: "calc(8px + env(safe-area-inset-right, 0px))",
        zIndex: 50,
        width: LADO_BOTON_PX,
        height: LADO_BOTON_PX,
        borderRadius: 12,
        border: "none",
        background: "var(--color-cromado-fondo)",
        color: "var(--color-cromado-texto)",
        font: `${tamTexto(20)} system-ui, sans-serif`,
        cursor: "pointer",
      }}
    >
      <span aria-hidden="true">{triple ? "×3" : "⏩"}</span>
    </button>
  );
}
