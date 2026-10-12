"use client";

import { BromaHUD } from "@/juego/hud/BromaHUD";
import { CartelEventoHUD } from "@/juego/hud/UniversoHUD";

// El cartel de evento y el resumen de la partida se anunciaban dentro de la
// capa de la consola, que se aparta (opacidad 0) durante el vuelo y el turno
// del rival y desaparece con la consola oculta: justo cuando llegan casi
// todos los eventos. Esta capa es hermana de la consola, así que se ve siempre.
// Sin eventos de puntero salvo en los propios paneles.
export function CapaAvisosHUD() {
  return (
    <div
      data-testid="capa-avisos"
      style={{
        position: "absolute",
        top: "calc(10vh + env(safe-area-inset-top))",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(92vw, 340px)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      <CartelEventoHUD />
      <BromaHUD />
    </div>
  );
}
