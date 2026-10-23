"use client";

import { useState, useSyncExternalStore } from "react";
import { MarcaAsiento } from "@/juego/hud/MarcaAsiento";
import { textoGanador } from "@/juego/textosPartida";
import { obtenerParticipantes, suscribirParticipantes } from "@/juego/control/participantesStore";
import { obtenerParteDeGuerra, solicitarOtraPartida, suscribirParteDeGuerra } from "@/juego/control/parteDeGuerraStore";
import { tamTexto } from "@/juego/hud/legibilidad";

// Pantalla final (humor-7): se superpone al tablero ya congelado (la
// partida ha terminado, nadie va a disparar otra vez) mostrando la medalla y
// los números reales que la sustentan -- nunca solo el nombre de la medalla,
// que sería indistinguible de un remate fijo. El ganador se nombra siempre,
// también en 1 humano contra IA: sin él, la medalla sola no dice si has ganado.
// premios-parte: cada asiento (gane o pierda, humano o IA) tiene su tarjeta
// con 1-2 premios y la cifra que lo justifica. Las estadísticas en bruto del
// ganador siguen ahí, pero plegadas en «Ver números», para que a 360x640 con
// 4 asientos la rejilla de 2x2 quepa; con textos de 14 px o más el contenido
// puede desplazarse dentro del panel, y «Otra partida» queda fija al pie.
export function ParteDeGuerraHUD() {
  const { parte, tarjetas } = useSyncExternalStore(suscribirParteDeGuerra, obtenerParteDeGuerra, obtenerParteDeGuerra);
  const [numerosAbiertos, setNumerosAbiertos] = useState(false);

  const { ganador, ganadorEsHumano, humanos } = useSyncExternalStore(suscribirParticipantes, obtenerParticipantes, obtenerParticipantes);

  if (!parte) return null;

  return (
    <div
      data-testid="parte-de-guerra"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 25,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(4,5,10,0.82)",
        color: "#e8eaf0",
        font: `${tamTexto(14)} system-ui, sans-serif`,
        textAlign: "center",
        padding: 12,
      }}
    >
      {/* Panel opaco: sobre el velo semitransparente axe no puede decidir el
          contraste (queda «incomplete»). El velo se queda alrededor para ver
          el tablero congelado, y el contenido se desplaza dentro del panel
          mientras «Otra partida» queda fija al pie. */}
      <div
        style={{
          boxSizing: "border-box",
          width: "100%",
          maxWidth: 520,
          maxHeight: "100%",
          overflowY: "auto",
          padding: "12px 12px 0",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "#0a0c14",
        }}
      >
        <h2 data-testid="ganador-nombre" style={{ margin: "0 0 4px", fontSize: tamTexto(18), overflowWrap: "anywhere" }}>
          {textoGanador({ ganador, ganadorEsHumano, humanos })}
        </h2>
        <h2 data-testid="parte-de-guerra-medalla" style={{ color: "#ffe08a", margin: "0 0 4px", fontSize: tamTexto(16) }}>
          {parte.medalla}
        </h2>
        <p data-testid="parte-de-guerra-texto" style={{ margin: "0 0 8px", fontSize: tamTexto(14) }}>
          {parte.texto}
        </p>
        <div
          data-testid="premios-rejilla"
          style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, textAlign: "left" }}
        >
          {tarjetas.map((tarjeta) => (
            <section
              key={tarjeta.asiento}
              data-testid={`premio-asiento-${tarjeta.asiento}`}
              style={{
                minWidth: 0,
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.05)",
                overflow: "hidden",
              }}
            >
              <div
                data-testid={`premio-asiento-nombre-${tarjeta.asiento}`}
                style={{ display: "flex", alignItems: "center", gap: 6, font: `600 ${tamTexto(14)} system-ui, sans-serif`, minWidth: 0 }}
              >
                <MarcaAsiento asiento={tarjeta.asiento} alto={14} />
                <span style={{ overflowWrap: "anywhere", minWidth: 0 }}>{tarjeta.nombre}</span>
              </div>
              {tarjeta.premios.map((premio) => (
                <div key={premio.id} data-testid="premio" style={{ marginTop: 4, overflowWrap: "anywhere" }}>
                  <div style={{ color: "#ffe08a", font: `600 ${tamTexto(14)} system-ui, sans-serif` }}>{premio.nombre}</div>
                  <div style={{ font: `${tamTexto(14)} system-ui, sans-serif`, color: "#cfd3df" }}>{premio.texto}</div>
                </div>
              ))}
            </section>
          ))}
        </div>
        <button
          type="button"
          data-testid="ver-numeros"
          aria-expanded={numerosAbiertos}
          aria-controls="parte-numeros"
          onClick={() => setNumerosAbiertos((abierto) => !abierto)}
          style={{
            marginTop: 8,
            minHeight: 44,
            padding: "4px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "transparent",
            color: "#e8eaf0",
            font: `${tamTexto(14)} system-ui, sans-serif`,
            cursor: "pointer",
          }}
        >
          Ver números
        </button>
        {numerosAbiertos && (
          <table
            id="parte-numeros"
            data-testid="tabla-numeros"
            style={{ width: "100%", marginTop: 6, borderCollapse: "collapse", font: `${tamTexto(14)} system-ui, sans-serif` }}
          >
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left" }}>Asiento</th>
                <th scope="col">Disparos</th>
                <th scope="col">Aciertos</th>
                <th scope="col">Daño hecho</th>
                <th scope="col">Autoimpactos</th>
              </tr>
            </thead>
            <tbody>
              {tarjetas.map((tarjeta) => (
                <tr key={tarjeta.asiento} data-testid={`fila-numeros-${tarjeta.asiento}`}>
                  <th scope="row" style={{ textAlign: "left", overflowWrap: "anywhere" }}>{tarjeta.nombre}</th>
                  <td>{tarjeta.estadisticas.disparos}</td>
                  <td>{tarjeta.estadisticas.aciertos}</td>
                  <td>{tarjeta.estadisticas.danioHecho}</td>
                  <td>{tarjeta.estadisticas.autoimpactos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ position: "sticky", bottom: 0, padding: "0 0 12px", background: "#0a0c14" }}>
          <button
            type="button"
            data-testid="otra-partida"
            onClick={solicitarOtraPartida}
            style={{
              marginTop: 8,
              minHeight: 44,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "#ff6b4a",
              color: "#12141a",
              font: `600 ${tamTexto(14)} system-ui, sans-serif`,
              cursor: "pointer",
            }}
          >
            Otra partida
          </button>
        </div>
      </div>
    </div>
  );
}
