"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { obtenerUniverso, suscribirUniverso } from "@/juego/control/universoStore";

// Lo que dura el cartel en pantalla antes de irse solo.
export const DURACION_CARTEL_MS = 2500;

// evt-5: «Próximo evento en N turnos», y un turno antes cuál es y a quién cae.
export function PronosticoHUD() {
  const { pronostico } = useSyncExternalStore(suscribirUniverso, obtenerUniverso, obtenerUniverso);
  if (pronostico === null) return null;
  return (
    <div
      data-testid="pronostico"
      role="status"
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "var(--color-roce-fondo)",
        border: "1px solid var(--color-roce-borde)",
        borderRadius: 10,
        // consola-compacta: con la consola a 320 px el texto del evento
        // inminente no cabe en una línea a 12 px y padding 10.
        padding: "4px 6px",
        color: "var(--color-roce-texto)",
        font: "11px system-ui, sans-serif",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        pointerEvents: "none",
        flexShrink: 0,
      }}
    >
      {pronostico}
    </div>
  );
}

// ms-2: «Muerte súbita en 1 ronda» la ronda anterior y el drenaje después.
export function MuerteSubitaHUD() {
  const { muerteSubita } = useSyncExternalStore(suscribirUniverso, obtenerUniverso, obtenerUniverso);
  if (muerteSubita === null) return null;
  return (
    <div
      data-testid="muerte-subita"
      role="status"
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "rgba(120,20,30,0.85)",
        border: "1px solid #ff8a8a",
        borderRadius: 10,
        padding: "4px 10px",
        color: "#fff",
        font: "bold 12px system-ui, sans-serif",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        pointerEvents: "none",
        flexShrink: 0,
      }}
    >
      {muerteSubita}
    </div>
  );
}

// evt-6: arriba, ≤ 56 px de alto, sin capturar toques, y se va solo.
export function CartelEventoHUD() {
  const { cartel } = useSyncExternalStore(suscribirUniverso, obtenerUniverso, obtenerUniverso);
  // Se guarda qué cartel ya se retiró, no cuál se ve: así el efecto solo
  // actualiza estado desde el temporizador y un cartel nuevo se ve de inmediato.
  const [retiradoClave, setRetiradoClave] = useState<number | null>(null);
  // La dependencia es la clave y no el objeto: el almacén emite un objeto
  // nuevo con cualquier cambio (p. ej. el pronóstico) y eso reiniciaba el reloj.
  const claveCartel = cartel?.clave ?? null;
  useEffect(() => {
    if (claveCartel === null) return;
    const temporizador = window.setTimeout(() => setRetiradoClave(claveCartel), DURACION_CARTEL_MS);
    return () => window.clearTimeout(temporizador);
  }, [claveCartel]);
  if (cartel === null || retiradoClave === cartel.clave) return null;
  return (
    <div
      data-testid="cartel-evento"
      role="status"
      style={{
        position: "fixed",
        top: "calc(8px + env(safe-area-inset-top))",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(92vw, 340px)",
        maxHeight: 56,
        boxSizing: "border-box",
        background: "rgba(20, 16, 48, 0.88)",
        border: "2px solid #ffd23f",
        borderRadius: 12,
        padding: "6px 12px",
        color: "#fff",
        font: "600 14px system-ui, sans-serif",
        textAlign: "center",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      {cartel.texto}
    </div>
  );
}
