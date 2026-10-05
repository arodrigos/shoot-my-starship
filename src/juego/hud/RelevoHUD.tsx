"use client";

import { useSyncExternalStore } from "react";
import { confirmarRelevo, obtenerRelevo, suscribirRelevo } from "@/juego/control/relevoStore";

// Pantalla opaca a pantalla completa: tapa el campo y la consola para que
// quien recibe el dispositivo no vea la información del anterior, y no deja
// pasar toques al control de apuntado que hay debajo. Los colores van fijos
// (fondo oscuro, texto claro) para dar 4,5:1 sin depender del tema.
export function RelevoHUD() {
  const relevo = useSyncExternalStore(suscribirRelevo, obtenerRelevo, obtenerRelevo);
  if (!relevo.activo || relevo.jugador === null) return null;
  const { resumen } = relevo;

  return (
    <div
      data-testid="pantalla-relevo"
      role="dialog"
      aria-modal="true"
      aria-label={`Relevo: turno de ${relevo.jugador}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 20,
        background: "#12141a",
        color: "#e8eaf0",
        font: "14px system-ui, sans-serif",
        textAlign: "center",
        overflowY: "auto",
      }}
    >
      <h2 data-testid="relevo-jugador" style={{ margin: 0, fontSize: 22, overflowWrap: "anywhere" }}>
        Turno de {relevo.jugador}
      </h2>
      {resumen && (
        <p data-testid="relevo-resumen" style={{ margin: 0, maxWidth: 320, font: "15px system-ui, sans-serif" }}>
          {resumen.fallo
            ? `${resumen.tirador} ha fallado${resumen.arma ? ` con ${resumen.arma}` : ""}.`
            : `${resumen.tirador} ha disparado ${resumen.arma ?? "su arma"} y ha hecho ${resumen.danio} de daño.`}
          {resumen.eliminadas.map((nombre) => ` ${nombre} queda eliminada.`).join("")}
        </p>
      )}
      {relevo.broma && (
        <p data-testid="relevo-broma" style={{ margin: 0, maxWidth: 320, fontStyle: "italic", color: "#ffe08a" }}>
          «{relevo.broma}»
        </p>
      )}
      <button
        type="button"
        data-testid="relevo-confirmar"
        onClick={confirmarRelevo}
        style={{
          minWidth: 160,
          minHeight: 48,
          padding: "8px 16px",
          border: "2px solid #ffcc66",
          borderRadius: 10,
          background: "#8a2c14",
          color: "#ffffff",
          font: "bold 16px system-ui, sans-serif",
        }}
      >
        Soy {relevo.jugador}
      </button>
    </div>
  );
}
