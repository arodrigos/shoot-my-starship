"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { obtenerNavesCss, obtenerZonas, suscribirNaves, suscribirZonas } from "@/juego/camara/zonasOcupadas";
import { AvisoSinGuardadoHUD } from "@/juego/hud/AvisoSinGuardadoHUD";
import { BromaHUD } from "@/juego/hud/BromaHUD";
import { AvisoTiempoAgotadoHUD } from "@/juego/hud/RelojTurnoHUD";
import { ReaccionHUD } from "@/juego/hud/ReaccionHUD";
import { CartelEventoHUD } from "@/juego/hud/UniversoHUD";
import { anclajePisaNaves, elegirAnclajeAvisos, HUECO_SOBRE_CONSOLA_PX, TOP_CAPA_AVISOS_PX, type AnclajeAvisos } from "@/juego/hud/anclajeAvisos";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";

// El cartel de evento y el resumen de la partida se anunciaban dentro de la
// capa de la consola, que se aparta (opacidad 0) durante el vuelo y el turno
// del rival y desaparece con la consola oculta: justo cuando llegan casi
// todos los eventos. Esta capa es hermana de la consola, así que se ve siempre.
// Sin eventos de puntero salvo en los propios paneles.
// «arriba» queda por debajo del rótulo de la deriva que pinta el lienzo (hasta
// ~126 px con dos líneas): los avisos tienen sitio propio y no se pisan con él.
// Alto que se reserva al elegir el anclaje: la capa está vacía cuando se elige.
const ALTO_ESTIMADO_AVISO_PX = 96;

export function CapaAvisosHUD() {
  const navesCss = useSyncExternalStore(suscribirNaves, obtenerNavesCss, obtenerNavesCss);
  const zonas = useSyncExternalStore(suscribirZonas, obtenerZonas, obtenerZonas);
  const turno = useSyncExternalStore(suscribirControl, () => obtenerEstadoControl().turno, () => 0);
  const [anclaje, setAnclaje] = useState<AnclajeAvisos>("arriba");
  const [sinToques, setSinToques] = useState(false);
  const capa = useRef<HTMLDivElement>(null);
  const turnoPrevio = useRef(turno);
  const zonaConsola = zonas.find((z) => z.id === "consola") ?? null;

  // Solo se cambia de sitio al cambiar de turno o con la capa vacía: un aviso
  // en pantalla no salta de un lado a otro.
  useEffect(() => {
    const cambioTurno = turnoPrevio.current !== turno;
    turnoPrevio.current = turno;
    const vacia = capa.current === null || capa.current.childElementCount === 0;
    if (!cambioTurno && !vacia) return;
    const viewport = { ancho: window.innerWidth, alto: window.innerHeight };
    const elegido = elegirAnclajeAvisos(navesCss, zonaConsola, viewport, ALTO_ESTIMADO_AVISO_PX);
    setAnclaje(elegido);
    setSinToques(anclajePisaNaves(elegido, navesCss, zonaConsola, viewport, ALTO_ESTIMADO_AVISO_PX));
  }, [navesCss, zonaConsola, turno]);

  const sobreConsola = anclaje === "sobre-consola" && zonaConsola !== null && typeof window !== "undefined";
  return (
    <div
      ref={capa}
      data-testid="capa-avisos"
      data-anclaje={sobreConsola ? "sobre-consola" : "arriba"}
      // Si los dos sitios pisan una nave, ni el cierre de la broma recoge
      // toques (regla en globals.css): los avisos pasan por encima.
      data-sin-toques={sinToques ? "" : undefined}
      style={{
        ...(sobreConsola && zonaConsola !== null
          ? { position: "fixed", bottom: window.innerHeight - zonaConsola.y + HUECO_SOBRE_CONSOLA_PX }
          : { position: "absolute", top: `calc(${TOP_CAPA_AVISOS_PX}px + env(safe-area-inset-top))` }),
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
      <AvisoTiempoAgotadoHUD />
      <AvisoSinGuardadoHUD />
      <ReaccionHUD />
    </div>
  );
}
