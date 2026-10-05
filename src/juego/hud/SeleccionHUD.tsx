"use client";

import { useSyncExternalStore } from "react";
import {
  alternarArmaEnSeleccion,
  confirmarSeleccion,
  identificarJugadorSeleccion,
  obtenerSeleccion,
  suscribirSeleccion,
} from "@/juego/control/seleccionStore";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { FACILIDAD_MEDIDA_PCT } from "@/sim/armas/facilidadMedida";
import type { Arma } from "@/sim/armas/tipos";
import { PRESUPUESTO_BASE, costeArma } from "@/sim/partida/economia";

function danioDe(arma: Arma): number {
  return arma.efecto.tipo === "empuje" ? 0 : arma.efecto.danioMaximo;
}

// Un color por arma, repartido por el círculo cromático: el icono es solo una
// seña rápida para reconocer la fila sin leerla, no sustituye al nombre.
function colorDeIcono(indice: number): string {
  return `hsl(${Math.round((indice * 360) / CATALOGO_ARMAS.length)} 75% 32%)`;
}

const FONDO = "#12141a";
const TEXTO = "#e8eaf0";
const TEXTO_SUAVE = "#b9bfce";
const AMARILLO = "#ffcc66";

// Pantalla opaca a pantalla completa, como el relevo: tapa el campo para que
// el siguiente jugador no vea lo elegido por el anterior. Con varios humanos
// pide primero identificarse; la selección solo se pinta tras ese toque, así
// el saldo y las armas de nadie están en el DOM mientras otro sostiene el
// dispositivo.
export function SeleccionHUD() {
  const estado = useSyncExternalStore(suscribirSeleccion, obtenerSeleccion, obtenerSeleccion);
  if (!estado.activa || estado.jugador === null) return null;

  const contenedor = {
    position: "fixed",
    inset: 0,
    zIndex: 45,
    display: "flex",
    flexDirection: "column",
    background: FONDO,
    color: TEXTO,
    font: "14px system-ui, sans-serif",
  } as const;

  if (!estado.identificado) {
    return (
      <div
        data-testid="pantalla-seleccion"
        role="dialog"
        aria-modal="true"
        aria-label={`Selección de armas de ${estado.jugador}`}
        style={{ ...contenedor, alignItems: "center", justifyContent: "center", gap: 14, padding: 20, textAlign: "center" }}
      >
        <h2 style={{ margin: 0, fontSize: 22, overflowWrap: "anywhere" }}>Prepara tus armas, {estado.jugador}</h2>
        <p style={{ margin: 0, maxWidth: 320 }}>Pasa el dispositivo a {estado.jugador}: elegirá sus armas en privado.</p>
        <button
          type="button"
          data-testid="seleccion-identificar"
          onClick={identificarJugadorSeleccion}
          style={{
            minWidth: 160,
            minHeight: 48,
            padding: "8px 16px",
            border: `2px solid ${AMARILLO}`,
            borderRadius: 10,
            background: "#8a2c14",
            color: "#ffffff",
            font: "bold 16px system-ui, sans-serif",
          }}
        >
          Soy {estado.jugador}
        </button>
      </div>
    );
  }

  const { seleccion } = estado;
  return (
    <div
      data-testid="pantalla-seleccion"
      role="dialog"
      aria-modal="true"
      aria-label={`Selección de armas de ${estado.jugador}`}
      style={contenedor}
    >
      <header style={{ padding: "10px 12px 6px", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
        {/* La partida de siempre llama «Tú» al único humano: «Arsenal de Tú» suena a error. */}
        <h2 style={{ margin: 0, fontSize: 17, overflowWrap: "anywhere" }}>
          {estado.jugador === "Tú" ? "Tu arsenal" : `Arsenal de ${estado.jugador}`}
        </h2>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: TEXTO_SUAVE }}>
          <strong data-testid="seleccion-saldo" style={{ color: TEXTO }}>
            {seleccion.saldo} cr
          </strong>{" "}
          disponibles
          {estado.arrastrado > 0 && (
            <span data-testid="seleccion-arrastrado"> ({PRESUPUESTO_BASE} + {estado.arrastrado} arrastrados)</span>
          )}{" "}
          · cada arma elegida es un disparo · precio según daño y facilidad de acierto
        </p>
      </header>

      <ul
        data-testid="seleccion-lista"
        style={{ listStyle: "none", margin: 0, padding: "8px 12px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}
      >
        {CATALOGO_ARMAS.map((arma, indice) => {
          const elegida = seleccion.armas.includes(arma.id);
          const coste = costeArma(arma);
          const pagable = coste <= seleccion.saldo;
          return (
            <li key={arma.id}>
              <button
                type="button"
                data-testid={`seleccion-arma-${arma.id}`}
                aria-pressed={elegida}
                onClick={() => alternarArmaEnSeleccion(arma.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  minHeight: 52,
                  padding: "6px 8px",
                  textAlign: "left",
                  border: elegida ? `2px solid ${AMARILLO}` : "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 8,
                  background: elegida ? "#2a2f3d" : "#1b1e27",
                  color: TEXTO,
                  font: "13px system-ui, sans-serif",
                  opacity: elegida || pagable ? 1 : 0.6,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: "0 0 36px",
                    height: 36,
                    borderRadius: 18,
                    display: "grid",
                    placeItems: "center",
                    background: colorDeIcono(indice),
                    color: "#ffffff",
                    font: "bold 16px system-ui, sans-serif",
                  }}
                >
                  {arma.nombre.replace(/^(La|El)\s+/, "").charAt(0)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", overflowWrap: "anywhere" }}>{arma.nombre}</strong>
                  <span data-testid={`seleccion-datos-${arma.id}`} style={{ color: TEXTO_SUAVE }}>
                    Daño {danioDe(arma)} · Acierto {FACILIDAD_MEDIDA_PCT[arma.id] ?? 0}%
                  </span>
                </span>
                <span data-testid={`seleccion-coste-${arma.id}`} style={{ flex: "0 0 auto", fontWeight: "bold" }}>
                  {coste > 0 ? `${coste} cr` : "Gratis"}
                  {elegida ? " ✓" : ""}
                </span>
              </button>
            </li>
          );
        })}
        <li
          data-testid="seleccion-objetos"
          style={{ padding: "8px", border: "1px dashed rgba(255,255,255,0.3)", borderRadius: 8, color: TEXTO_SUAVE, font: "13px system-ui, sans-serif" }}
        >
          Objetos (escudos, propulsores…): próximamente.
        </li>
      </ul>

      <footer style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.2)", display: "flex", flexDirection: "column", gap: 6 }}>
        {estado.error && (
          <p data-testid="seleccion-error" role="alert" style={{ margin: 0, color: AMARILLO }}>
            {estado.error}
          </p>
        )}
        {estado.avisoVacio && (
          <p data-testid="seleccion-aviso-vacio" role="alert" style={{ margin: 0, color: AMARILLO }}>
            No has elegido ninguna arma: solo podrás usar las 3 gratis. Pulsa de nuevo para empezar así.
          </p>
        )}
        <button
          type="button"
          data-testid="seleccion-confirmar"
          onClick={confirmarSeleccion}
          style={{
            minHeight: 48,
            padding: "8px 16px",
            border: `2px solid ${AMARILLO}`,
            borderRadius: 10,
            background: "#8a2c14",
            color: "#ffffff",
            font: "bold 16px system-ui, sans-serif",
          }}
        >
          {estado.avisoVacio ? "Empezar solo con las gratis" : `Empezar (${seleccion.armas.length} ${seleccion.armas.length === 1 ? "arma" : "armas"})`}
        </button>
      </footer>
    </div>
  );
}
