"use client";

import { useState } from "react";
import { PERSONALIDADES } from "@/sim/ia/personalidades";
import { almacenamientoDisponible, guardarRivalElegido, leerProgreso } from "@/juego/control/progreso";
import { desbloquearAudio } from "@/juego/audio/motor";

const RIVAL_POR_DEFECTO_ID = "la-contable";

interface Props {
  readonly onJugar: (rivalId: string) => void;
}

// partida-4: primera visita y estados vacíos. Vive fuera del lienzo (no
// necesita saber dónde está el terreno) y es la última pieza que faltaba
// del recorrido que Adrián hace con el dedo (partida-1): sin esto no había
// dónde elegir rival ni un gesto real desde el que desbloquear el audio
// (ver la desviación ya retirada de humor-4/Partida.ts).
export function PantallaInicio({ onJugar }: Props) {
  const [progreso] = useState(() => leerProgreso());
  // Sondeo de escritura real, no una suposición sobre el navegador
  // (partida-5): se hace una sola vez, al montar, y el aviso -- si aparece
  // -- se queda visible el resto de la sesión en esta pantalla, no se repite
  // en cada intento de guardado.
  const [sinAlmacenamiento] = useState(() => !almacenamientoDisponible());
  const [rivalId, setRivalId] = useState(progreso.rivalId ?? RIVAL_POR_DEFECTO_ID);

  function alJugar(): void {
    // Gesto real del usuario (el propio clic): el sitio legítimo para
    // desbloquear el AudioContext, igual que el pointerdown de Partida.ts
    // que sigue sirviendo de red de seguridad para gestos posteriores.
    desbloquearAudio();
    guardarRivalElegido(rivalId);
    onJugar(rivalId);
  }

  return (
    <div
      data-testid="pantalla-inicio"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "#12141a",
        color: "#e8eaf0",
        font: "14px system-ui, sans-serif",
        textAlign: "center",
        padding: 24,
        overflowY: "auto",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22 }}>Shoot my starship</h1>
      <p data-testid="descripcion-juego" style={{ maxWidth: 360, margin: 0 }}>
        Naves varadas en el Cinturón de la Deriva que se tiran chatarra a cañonazos: arrastra en la mitad inferior de
        la pantalla para fijar ángulo y potencia, y pulsa Disparar cuando apuntes bien.
      </p>

      {sinAlmacenamiento && (
        <p
          role="status"
          data-testid="aviso-sin-almacenamiento"
          style={{ maxWidth: 360, margin: 0, color: "#ffe08a", font: "12px system-ui, sans-serif" }}
        >
          No se van a guardar tus preferencias ni el resumen de tu última partida: el almacenamiento local no está
          disponible en este navegador (modo privado estricto o cuota agotada). Se puede jugar igual.
        </p>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 360 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Elige rival</h2>
        {PERSONALIDADES.map((personalidad) => (
          <button
            key={personalidad.id}
            type="button"
            data-testid={`rival-${personalidad.id}`}
            aria-pressed={personalidad.id === rivalId}
            onClick={() => setRivalId(personalidad.id)}
            style={{
              ...botonEstilo,
              textAlign: "left",
              border:
                personalidad.id === rivalId ? "2px solid #ffcc66" : "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <strong>{personalidad.nombre}</strong>
            <br />
            <span style={{ font: "12px system-ui, sans-serif" }}>{personalidad.descripcion}</span>
          </button>
        ))}
      </section>

      <section data-testid="ultima-partida" style={{ maxWidth: 360 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>Tu última partida</h2>
        {progreso.ultimaPartida ? (
          <p style={{ margin: 0 }}>
            <strong>{progreso.ultimaPartida.medalla}</strong>
            <br />
            {progreso.ultimaPartida.texto}
          </p>
        ) : (
          <p data-testid="ultima-partida-vacia" style={{ margin: 0 }}>
            Todavía no has jugado ninguna partida en este navegador: aquí verás la medalla de tu última batalla en
            cuanto termines una.
          </p>
        )}
      </section>

      <button
        type="button"
        data-testid="boton-jugar"
        onClick={alJugar}
        style={{ ...botonEstilo, background: "#ff6b4a", minWidth: 140, minHeight: 44, font: "16px system-ui, sans-serif" }}
      >
        Jugar
      </button>
    </div>
  );
}

const botonEstilo: React.CSSProperties = {
  minHeight: 24,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(30,34,46,0.9)",
  color: "#e8eaf0",
  font: "13px system-ui, sans-serif",
  cursor: "pointer",
};
