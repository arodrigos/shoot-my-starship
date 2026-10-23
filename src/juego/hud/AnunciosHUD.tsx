"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { anunciar, obtenerAnuncio, obtenerHistorialAnuncios, reiniciarAnuncios, suscribirAnuncios, textoAnuncioTurno } from "@/juego/control/anunciosStore";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";
import { obtenerParteDeGuerra, suscribirParteDeGuerra } from "@/juego/control/parteDeGuerraStore";
import { obtenerParticipantes } from "@/juego/control/participantesStore";
import { obtenerRelojTurno, suscribirRelojTurno } from "@/juego/control/relojTurnoStore";
import { textoGanador } from "@/juego/textosPartida";

// Fuera de la vista pero dentro del árbol de accesibilidad: display:none o
// visibility:hidden harían que el lector ignorase los cambios.
const SOLO_LECTORES: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

// Se monta vacía con la partida (la región tiene que existir antes del primer
// evento para que el lector la vigile) y anuncia el cambio de turno, el
// «¡Tiempo!» y el ganador.
export function AnunciosHUD() {
  const { texto, secuencia } = useSyncExternalStore(suscribirAnuncios, obtenerAnuncio, obtenerAnuncio);
  // El texto se escribe a mano en el nodo: React no repintaría un texto igual
  // al anterior, y justo ese caso es el que hay que volver a anunciar.
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => {
    reiniciarAnuncios();
    window.__debug = window.__debug ?? {};
    window.__debug.anuncios = obtenerHistorialAnuncios;

    let turnoPrevio = obtenerEstadoControl().turno;
    let avisoPrevio = obtenerRelojTurno().aviso;
    let partePrevio = obtenerParteDeGuerra().parte !== null;

    const desuscribirControl = suscribirControl(() => {
      const turno = obtenerEstadoControl().turno;
      if (turno === turnoPrevio) return;
      turnoPrevio = turno;
      const { participantes, rivalesIA, humanos } = obtenerParticipantes();
      anunciar(textoAnuncioTurno(turno, { participantes, rivalesIA, humanos, nombreRival: obtenerEstadoControl().nombreRival }));
    });
    const desuscribirReloj = suscribirRelojTurno(() => {
      const aviso = obtenerRelojTurno().aviso;
      if (aviso && !avisoPrevio) anunciar("¡Tiempo! Disparo automático");
      avisoPrevio = aviso;
    });
    const desuscribirParte = suscribirParteDeGuerra(() => {
      const hayParte = obtenerParteDeGuerra().parte !== null;
      if (hayParte && !partePrevio) anunciar(textoGanador(obtenerParticipantes()));
      partePrevio = hayParte;
    });
    return () => {
      desuscribirControl();
      desuscribirReloj();
      desuscribirParte();
      if (window.__debug?.anuncios === obtenerHistorialAnuncios) delete window.__debug.anuncios;
    };
  }, []);

  // Vaciar y rellenar en el fotograma siguiente: sin el hueco, un texto igual
  // al anterior no cambia el DOM y el lector no lo repite.
  useEffect(() => {
    const nodo = region.current;
    if (!nodo) return;
    nodo.textContent = "";
    if (texto === "") return;
    const marco = requestAnimationFrame(() => {
      nodo.textContent = texto;
    });
    return () => cancelAnimationFrame(marco);
  }, [texto, secuencia]);

  return (
    <div ref={region} role="status" aria-live="polite" aria-atomic="true" data-testid="anuncios-hud" style={SOLO_LECTORES} />
  );
}
