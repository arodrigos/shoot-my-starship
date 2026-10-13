"use client";

import { useSyncExternalStore } from "react";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";
import { AyudaApuntadoHUD } from "@/juego/hud/AyudaApuntadoHUD";
import { BromaHUD } from "@/juego/hud/BromaHUD";
import { ReaccionHUD } from "@/juego/hud/ReaccionHUD";
import { CartelEventoHUD } from "@/juego/hud/UniversoHUD";

// El cartel de evento y el resumen de la partida se anunciaban dentro de la
// capa de la consola, que se aparta (opacidad 0) durante el vuelo y el turno
// del rival y desaparece con la consola oculta: justo cuando llegan casi
// todos los eventos. Esta capa es hermana de la consola, así que se ve siempre.
// Sin eventos de puntero salvo en los propios paneles.
// Por debajo de las dos filas de interruptores (hasta ~104 px) y del rótulo de
// la deriva que pinta el lienzo (hasta ~126 px con dos líneas): los avisos
// tienen sitio propio y no se pisan con ellos.
const TOP_CAPA_AVISOS_PX = 130;

// El aviso de «sin voz» vivía bajo el interruptor, en 11 px y sin fondo, sobre
// el lienzo y tapado por otros textos. Ahora es un panel opaco de esta capa.
function AvisoVozHUD() {
  const aviso = useSyncExternalStore(
    suscribirControl,
    () => obtenerEstadoControl().avisoVoz,
    () => null,
  );
  if (aviso === null) return null;
  return (
    <div
      data-testid="voz-aviso"
      role="status"
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "rgb(10,12,20)",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: 8,
        padding: "6px 10px",
        color: "#e8eaf0",
        font: "12px/1.3 system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      {aviso}
    </div>
  );
}

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
      <CartelEventoHUD />
      <BromaHUD />
      <AvisoVozHUD />
      <ReaccionHUD />
    </div>
  );
}
