"use client";

import { useSyncExternalStore } from "react";
import { cerrarAyudaCamara, obtenerCamaraHud, pedirVerTodo, suscribirCamaraHud } from "@/juego/control/camaraStore";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";

export const TEXTO_AYUDA_CAMARA = "Pellizca con dos dedos para acercar; «Ver todo» para volver";

// camara-gestos (cam-3): solo existe con la cámara en manual, así que el
// botón desaparece del DOM al volver a la vista completa. Fijo al borde
// derecho, a media altura: ni la consola de abajo ni los botones de arriba.
export function VerTodoHUD() {
  const manual = useSyncExternalStore(suscribirCamaraHud, () => obtenerCamaraHud().manual, () => false);
  if (!manual) return null;
  return (
    <button
      type="button"
      data-testid="ver-todo"
      onClick={pedirVerTodo}
      style={{
        position: "fixed",
        right: "calc(8px + env(safe-area-inset-right))",
        top: "42%",
        zIndex: 41,
        minWidth: 44,
        minHeight: 44,
        padding: "0 12px",
        background: "#101a33",
        color: "#e8eefc",
        border: "1px solid #3b5aa8",
        borderRadius: 10,
        font: "14px system-ui, sans-serif",
      }}
    >
      Ver todo
    </button>
  );
}

// cam-10: la primera vez que se puede usar la cámara. Se va al tocarla o al
// primer gesto (la escena llama a cerrarAyudaCamara).
// Depende del control (puedeDisparar cambia por turno) y de su propio store.
function suscribirAyudaCamara(escucha: () => void): () => void {
  const bajas = [suscribirCamaraHud(escucha), suscribirControl(escucha)];
  return () => bajas.forEach((baja) => baja());
}

export function AyudaCamaraHUD() {
  const visible = useSyncExternalStore(
    suscribirAyudaCamara,
    () => obtenerCamaraHud().ayudaVisible && obtenerEstadoControl().puedeDisparar && !obtenerEstadoControl().ayudaVisible,
    () => false,
  );
  if (!visible) return null;
  return (
    <button
      type="button"
      data-testid="ayuda-camara"
      role="status"
      onClick={cerrarAyudaCamara}
      style={{
        width: "100%",
        minHeight: 44,
        pointerEvents: "auto",
        padding: "6px 8px",
        textAlign: "left",
        background: "#101a33",
        border: "1px solid #3b5aa8",
        borderRadius: 10,
        color: "#e8eefc",
        font: "12px system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {TEXTO_AYUDA_CAMARA}
    </button>
  );
}
