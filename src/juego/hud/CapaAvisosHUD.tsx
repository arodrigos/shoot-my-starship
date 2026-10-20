"use client";

import { AyudaApuntadoHUD } from "@/juego/hud/AyudaApuntadoHUD";
import { AyudaCamaraHUD } from "@/juego/hud/CamaraHUD";
import { AvisoSinGuardadoHUD } from "@/juego/hud/AvisoSinGuardadoHUD";
import { BromaHUD } from "@/juego/hud/BromaHUD";
import { AvisoTiempoAgotadoHUD } from "@/juego/hud/RelojTurnoHUD";
import { ReaccionHUD } from "@/juego/hud/ReaccionHUD";
import { CartelEventoHUD } from "@/juego/hud/UniversoHUD";

// El cartel de evento y el resumen de la partida se anunciaban dentro de la
// capa de la consola, que se aparta (opacidad 0) durante el vuelo y el turno
// del rival y desaparece con la consola oculta: justo cuando llegan casi
// todos los eventos. Esta capa es hermana de la consola, así que se ve siempre.
// Sin eventos de puntero salvo en los propios paneles.
// Por debajo del rótulo de la deriva que pinta el lienzo (hasta ~126 px con
// dos líneas): los avisos tienen sitio propio y no se pisan con él.
const TOP_CAPA_AVISOS_PX = 130;

export function CapaAvisosHUD() {
  return (
    <div
      data-testid="capa-avisos"
      style={{
        position: "absolute",
        top: `calc(${TOP_CAPA_AVISOS_PX}px + env(safe-area-inset-top))`,
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
      <AyudaApuntadoHUD />
      <AyudaCamaraHUD />
      <CartelEventoHUD />
      <BromaHUD />
      <AvisoTiempoAgotadoHUD />
      <AvisoSinGuardadoHUD />
      <ReaccionHUD />
    </div>
  );
}
