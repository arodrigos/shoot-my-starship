"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cerrarAyudaCamara, obtenerCamaraHud, pedirVerTodo, suscribirCamaraHud } from "@/juego/control/camaraStore";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";
import { tamTexto } from "@/juego/hud/legibilidad";

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
        font: `${tamTexto(14)} system-ui, sans-serif`,
      }}
    >
      Ver todo
    </button>
  );
}

// cam-10: la primera vez que se puede usar la cámara. Se va al primer gesto
// (la escena llama a cerrarAyudaCamara) o al primer toque en cualquier sitio.
// No recibe punteros: encima del lienzo tapaba los paneles que se abren bajo
// ella (selector de arma, pestañas de Equipo) y los clics no llegaban.
// Depende del control (puedeDisparar cambia por turno) y de su propio store.
function suscribirAyudaCamara(escucha: () => void): () => void {
  const bajas = [suscribirCamaraHud(escucha), suscribirControl(escucha)];
  return () => bajas.forEach((baja) => baja());
}

// `enConsola` elige el sitio: con «Texto grande» vive en la zona de la consola
// (la cámara ya la aparta de las naves); con texto normal sigue en la capa de
// avisos, porque meterla en la consola cambia el encuadre al disparar.
export function AyudaCamaraHUD({ enConsola = false }: { enConsola?: boolean }) {
  const visible = useSyncExternalStore(
    suscribirAyudaCamara,
    () => {
      const control = obtenerEstadoControl();
      // Con «Texto grande» las dos ayudas juntas ocupan tanto que la franja que
      // queda sobre la consola no cabe dos naves (la cámara no encuadra): sale
      // cuando se cierra la del apuntado.
      const esperaApuntado = control.textoGrande && control.ayudaApuntadoVisible;
      return control.textoGrande === enConsola && obtenerCamaraHud().ayudaVisible && control.puedeDisparar && !control.ayudaVisible && !esperaApuntado;
    },
    () => false,
  );
  useEffect(() => {
    if (!visible) return;
    // En captura y sin consumir el evento: el toque sigue su camino normal.
    window.addEventListener("pointerdown", cerrarAyudaCamara, { capture: true, once: true });
    return () => window.removeEventListener("pointerdown", cerrarAyudaCamara, { capture: true });
  }, [visible]);
  if (!visible) return null;
  return (
    <div
      data-testid="ayuda-camara"
      role="status"
      style={{
        width: "100%",
        minHeight: 44,
        pointerEvents: "none",
        padding: "6px 8px",
        textAlign: "left",
        background: "#101a33",
        border: "1px solid #3b5aa8",
        borderRadius: 10,
        color: "#e8eefc",
        font: `${tamTexto(14)} system-ui, sans-serif`,
        boxSizing: "border-box",
      }}
    >
      {TEXTO_AYUDA_CAMARA}
    </div>
  );
}
