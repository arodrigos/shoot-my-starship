"use client";

import { useSyncExternalStore } from "react";
import { obtenerCuentaAtras, suscribirCuentaAtras } from "@/juego/control/cuentaAtrasStore";

// arma-granada-espoleta (gra-2): contador propio, superpuesto a la ESQUINA
// SUPERIOR de la zona de juego (lay-1) con position:fixed -- nunca dentro de
// #game-container (ese div es solo del lienzo de Phaser, ver PhaserGame.tsx)
// ni dentro de la consola (flex 1 1 auto, debajo del 58% de zona de juego):
// al vivir en la mitad de pantalla donde ningún otro panel del HUD dibuja
// nada, su rectángulo es disjunto del de control/reacción/roce/broma por
// construcción geométrica, no por coincidencia, que es justo lo que gra-2
// exige comprobar.
export function CuentaAtrasHUD() {
  const estado = useSyncExternalStore(suscribirCuentaAtras, obtenerCuentaAtras, obtenerCuentaAtras);

  if (estado.segundos === null) return null;

  return (
    <div
      data-testid="panel-cuenta-atras"
      role="status"
      style={{
        position: "fixed",
        top: 10,
        right: 10,
        zIndex: 15,
        minWidth: 40,
        textAlign: "center",
        background: "var(--color-cuenta-atras-fondo)",
        border: "2px solid var(--color-cuenta-atras-borde)",
        borderRadius: "50%",
        padding: "10px 6px",
        color: "var(--color-cuenta-atras-texto)",
        font: "bold 20px system-ui, sans-serif",
        pointerEvents: "none",
      }}
    >
      {estado.segundos}
    </div>
  );
}
