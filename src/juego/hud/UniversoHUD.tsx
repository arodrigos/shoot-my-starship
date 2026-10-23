"use client";

import { useEffect, useSyncExternalStore } from "react";
import { obtenerUniverso, retirarCartel, suscribirUniverso } from "@/juego/control/universoStore";
import { tamTexto } from "@/juego/hud/legibilidad";

// Lo que dura el cartel en pantalla antes de irse solo.
export const DURACION_CARTEL_MS = 4000;

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
        font: `${tamTexto(14)} system-ui, sans-serif`,
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
        font: `bold ${tamTexto(14)} system-ui, sans-serif`,
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

// anu-1: el cartel se queda 4 s, lleva título, a quién afecta y qué hace, y los
// siguientes esperan en cola. Arriba, sin capturar toques.
export function CartelEventoHUD() {
  const { cartel } = useSyncExternalStore(suscribirUniverso, obtenerUniverso, obtenerUniverso);
  // La dependencia es la clave y no el objeto: el almacén emite un objeto
  // nuevo con cualquier cambio (p. ej. el pronóstico) y eso reiniciaba el reloj.
  const claveCartel = cartel?.clave ?? null;
  useEffect(() => {
    if (claveCartel === null) return;
    const temporizador = window.setTimeout(() => retirarCartel(claveCartel), DURACION_CARTEL_MS);
    return () => window.clearTimeout(temporizador);
  }, [claveCartel]);
  if (cartel === null) return null;
  return (
    <div
      data-testid="cartel-evento"
      role="status"
      style={{
        // Vive en CapaAvisosHUD, que lo coloca arriba y fuera de la consola.
        width: "100%",
        boxSizing: "border-box",
        background: "rgba(20, 16, 48, 0.92)",
        border: "2px solid #ffd23f",
        borderRadius: 12,
        padding: "8px 12px",
        color: "#fff",
        font: `500 ${tamTexto(14)}/1.3 system-ui, sans-serif`,
        textAlign: "center",
        overflowWrap: "anywhere",
        pointerEvents: "none",
      }}
    >
      <div data-testid="cartel-evento-titulo" style={{ font: `700 ${tamTexto(16)}/1.3 system-ui, sans-serif`, color: "#ffd23f" }}>
        {cartel.titulo}
      </div>
      <div data-testid="cartel-evento-quien" style={{ font: `600 ${tamTexto(14)}/1.3 system-ui, sans-serif`, color: cartel.quien?.color ?? "#fff" }}>
        {cartel.quien?.nombre ?? "Todos"}
      </div>
      <div data-testid="cartel-evento-texto">{cartel.texto}</div>
    </div>
  );
}
