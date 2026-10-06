"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ControlHUD } from "@/juego/hud/ControlHUD";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";

const CLAVE_PLEGADA = "consola:plegada";
// pan: tope de alto de la consola desplegada (45 % del viewport) y alfa del
// fondo (≤ 0,6) para que el lienzo se siga viendo por detrás.
const ALTO_DESPLEGADA = "45%";
const ALTO_PLEGADA_PX = 64;
const FONDO_DESPLEGADA = "rgba(10, 12, 20, 0.55)";

function leerPlegada(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_PLEGADA) === "1";
  } catch {
    return false;
  }
}

function guardarPlegada(valor: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_PLEGADA, valor ? "1" : "0");
  } catch {
    // Sin almacenamiento (modo privado) el estado vale solo para esta partida.
  }
}

interface Props {
  readonly children?: ReactNode;
}

// pantalla-completa: la consola deja de ser una franja que le quita alto al
// lienzo y pasa a ser una capa sobre él. El estado plegado vive aquí (no en
// ControlHUD) porque decide el tamaño de la capa, y se recuerda entre partidas.
export function ConsolaSuperpuesta({ children }: Props) {
  const [plegada, setPlegada] = useState<boolean>(leerPlegada);
  const puedeDisparar = useSyncExternalStore(suscribirControl, () => obtenerEstadoControl().puedeDisparar, () => false);

  function alternar(): void {
    setPlegada((actual) => {
      guardarPlegada(!actual);
      return !actual;
    });
  }

  // Durante el vuelo (y el turno del rival) la capa se aparta para no tapar la
  // trayectoria. Se hace con opacidad y sin eventos, no desmontando: el estado
  // del HUD sigue en el DOM y vuelve exactamente igual al terminar el turno.
  const oculta = !puedeDisparar;

  return (
    <div
      data-testid="consola"
      data-plegada={plegada ? "true" : "false"}
      data-oculta={oculta ? "true" : "false"}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
        height: plegada ? `calc(${ALTO_PLEGADA_PX}px + env(safe-area-inset-bottom, 0px))` : ALTO_DESPLEGADA,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: plegada ? "transparent" : FONDO_DESPLEGADA,
        opacity: oculta ? 0.0 : 1,
        pointerEvents: oculta ? "none" : "auto",
        transition: "opacity 120ms linear",
      }}
    >
      <ControlHUD plegada={plegada} alAlternarPlegado={alternar} />
      {children}
    </div>
  );
}
