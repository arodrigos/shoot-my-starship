"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { avisoVersionVisible, despacharPwa, obtenerDatosPwa, suscribirPwa } from "@/juego/pwa/estadoPwa";
import { recargarVersionNueva } from "@/juego/pwa/registroSw";

const DURACION_AVISO_LISTO_MS = 4000;

// A la izquierda del botón Ajustes (48 px + 8 de margen + hueco): estos avisos
// no pueden pisarlo en ningún ancho.
const ESTILO_AVISO: CSSProperties = {
  position: "fixed",
  top: "calc(8px + env(safe-area-inset-top, 0px))",
  left: "calc(8px + env(safe-area-inset-left, 0px))",
  right: "calc(64px + env(safe-area-inset-right, 0px))",
  zIndex: 60,
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: 12,
  background: "rgb(10,12,20)",
  border: "1px solid rgba(255,255,255,0.25)",
  color: "#e8eaf0",
  font: "14px system-ui, sans-serif",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
};

const ESTILO_BOTON: CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 8,
  border: "none",
  background: "var(--color-cromado-fondo)",
  color: "var(--color-cromado-texto)",
  font: "14px system-ui, sans-serif",
  cursor: "pointer",
};

export function AvisosPwa() {
  const datos = useSyncExternalStore(suscribirPwa, obtenerDatosPwa, obtenerDatosPwa);

  useEffect(() => {
    if (!datos.avisoListo) return;
    const temporizador = window.setTimeout(() => despacharPwa({ tipo: "aviso-listo-visto" }), DURACION_AVISO_LISTO_MS);
    return () => window.clearTimeout(temporizador);
  }, [datos.avisoListo]);

  if (avisoVersionVisible(datos)) {
    return (
      <div data-testid="aviso-version-nueva" role="status" style={ESTILO_AVISO}>
        <span style={{ flex: "1 1 auto" }}>Hay una versión nueva</span>
        <button type="button" data-testid="recargar-version" onClick={recargarVersionNueva} style={ESTILO_BOTON}>
          Recargar
        </button>
        <button
          type="button"
          data-testid="posponer-version"
          onClick={() => despacharPwa({ tipo: "luego" })}
          style={ESTILO_BOTON}
        >
          Luego
        </button>
      </div>
    );
  }
  if (datos.avisoListo) {
    return (
      <div data-testid="aviso-listo-sin-conexion" role="status" style={ESTILO_AVISO}>
        Listo para jugar sin conexión
      </div>
    );
  }
  return null;
}
