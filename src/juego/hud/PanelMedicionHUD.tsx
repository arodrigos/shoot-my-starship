"use client";

import { useSyncExternalStore } from "react";
import { cancelarMedicion, fijarCopiaMedicion, obtenerMedicion, reiniciarMedicion, suscribirMedicion } from "@/juego/control/medicionStore";
import { tamTexto } from "@/juego/hud/legibilidad";
import { NOMBRES_TRAMO } from "@/juego/rendimiento/resumenMedicion";

const Z = 2147483100;

// Vive fuera de JuegoLienzo: la partida de medición remonta el lienzo y el
// panel tiene que sobrevivir al remonte.
export function PanelMedicionHUD() {
  const medicion = useSyncExternalStore(suscribirMedicion, obtenerMedicion, obtenerMedicion);

  if (medicion.estado === "inactiva") return null;

  if (medicion.estado === "en-curso") {
    const tramo = medicion.tramo;
    return (
      <div
        data-testid="franja-medicion"
        style={{ position: "fixed", top: 290, left: 4, zIndex: Z, display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(0,0,0,.8)", color: "#9f9", font: `${tamTexto(13)}/1.3 monospace` }}
      >
        <span>{tramo ? `Midiendo · tramo ${tramo.indice} de ${tramo.total} (${NOMBRES_TRAMO[tramo.nombre]})` : "Midiendo…"}</span>
        <button type="button" data-testid="cancelar-medicion" onClick={cancelarMedicion} style={{ minWidth: 44, minHeight: 44, padding: "0 10px", font: "inherit", color: "#fff", background: "#512", border: "1px solid #f88", borderRadius: 6 }}>
          Cancelar
        </button>
      </div>
    );
  }

  const titulo = medicion.estado === "cancelada" ? "Medición cancelada" : medicion.estado === "incompleta" ? "Medición incompleta (tiempo agotado)" : "Resumen de la medición";
  const estadoCopia =
    medicion.copia === "copiada" ? "Copiado al portapapeles" : medicion.copia === "pendiente" ? "Copiando…" : "No se pudo copiar solo: pulsa Copiar o selecciona el texto";
  const texto = medicion.texto ?? "";

  const copiar = (): void => {
    if (typeof navigator.clipboard?.writeText !== "function") {
      fijarCopiaMedicion("no-soportada");
      return;
    }
    navigator.clipboard.writeText(texto).then(
      () => fijarCopiaMedicion("copiada"),
      () => fijarCopiaMedicion("fallida"),
    );
  };
  const cerrar = (): void => {
    reiniciarMedicion();
    // Recarga en la portada: la partida de medición no se guardó y «Continuar»
    // recupera la interrumpida tal cual estaba.
    window.location.reload();
  };

  return (
    <div
      role="dialog"
      aria-label={titulo}
      data-testid="panel-medicion"
      style={{ position: "fixed", inset: 0, zIndex: Z, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", padding: 8 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "min(100%, 560px)", maxHeight: "100%", padding: 12, borderRadius: 8, background: "#0b1224", color: "#e8eefc", border: "1px solid #3a4a7a" }}>
        <h2 style={{ margin: 0, fontSize: tamTexto(16) }}>{titulo}</h2>
        <textarea
          readOnly
          data-testid="texto-medicion"
          aria-label="Texto de la medición"
          value={texto}
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: "1 1 auto", minHeight: 160, height: "min(46vh, 340px)", width: "100%", boxSizing: "border-box", font: `${tamTexto(11)}/1.35 monospace`, background: "#050912", color: "#cfe", border: "1px solid #3a4a7a", borderRadius: 4, resize: "none" }}
        />
        <div data-testid="estado-copia" role="status" style={{ fontSize: tamTexto(13) }}>
          {estadoCopia}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" data-testid="copiar-medicion" onClick={copiar} style={{ minWidth: 44, minHeight: 44, padding: "0 14px", font: `600 ${tamTexto(14)} sans-serif` }}>
            Copiar
          </button>
          <button type="button" data-testid="cerrar-medicion" onClick={cerrar} style={{ minWidth: 44, minHeight: 44, padding: "0 14px", font: `600 ${tamTexto(14)} sans-serif` }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
