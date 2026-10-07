"use client";

import { useSyncExternalStore } from "react";
import { obtenerObjetos, suscribirObjetos } from "@/juego/control/objetosStore";

// Dos formas distintas (corazón / nube con rayo) y no solo dos colores: se
// distinguen también en escala de grises (WCAG 1.4.1).
function IconoCorazon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" data-testid="objeto-corazon-icono">
      <path d="M12 21 C5 15 2 11.5 2 8 A5 5 0 0 1 12 6 A5 5 0 0 1 22 8 C22 11.5 19 15 12 21 Z" fill="#ff4d79" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

function IconoTormenta() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" data-testid="objeto-tormenta-icono">
      <path d="M7 16 A4.5 4.5 0 0 1 7.5 7 A5.5 5.5 0 0 1 18 8 A4 4 0 0 1 17.5 16 Z" fill="#8a7bd8" stroke="#fff" strokeWidth="1.5" />
      <path d="M13 13 L10 19 L12.5 19 L11 23 L16 16.5 L13 16.5 L14.5 13 Z" fill="#ffd23f" stroke="#7a5c00" strokeWidth="0.8" />
    </svg>
  );
}

// obj-3: una leyenda por objeto vivo, con su icono, para que se vea qué flota
// y qué hace sin tener que adivinarlo en el lienzo.
export function ObjetosHUD() {
  const objetos = useSyncExternalStore(suscribirObjetos, obtenerObjetos, obtenerObjetos);
  if (objetos.length === 0) return null;
  return (
    <>
      {objetos.map((objeto) => (
        <div
          key={objeto.id}
          data-testid={`objeto-${objeto.tipo}`}
          role="status"
          style={{
            width: "100%",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: 6,
            minHeight: 24,
            background: "var(--color-roce-fondo)",
            border: "1px solid var(--color-roce-borde)",
            borderRadius: 10,
            padding: "2px 10px",
            color: "var(--color-roce-texto)",
            font: "12px system-ui, sans-serif",
            pointerEvents: "none",
            flexShrink: 0,
          }}
        >
          {objeto.tipo === "corazon" ? <IconoCorazon /> : <IconoTormenta />}
          {objeto.texto}
        </div>
      ))}
    </>
  );
}
