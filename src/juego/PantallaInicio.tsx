"use client";

import { useState } from "react";
import { PERSONALIDADES } from "@/sim/ia/personalidades";
import { almacenamientoDisponible, guardarRivalElegido, leerProgreso } from "@/juego/control/progreso";
import { desbloquearAudio } from "@/juego/audio/motor";
import { obtenerLocutor } from "@/juego/audio/voz";
import { PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import type { ModoJuego } from "@/sim/partida/tipos";
import { COLORES_NAVE } from "@/juego/naves/paletaNaves";
import { MAX_NAVES, MAX_NOMBRE_JUGADOR, MIN_NAVES, sanearNombre, type JugadorConfig } from "@/juego/jugadores";

const RIVAL_POR_DEFECTO_ID = "la-contable";
const MODO_POR_DEFECTO: ModoJuego = "barra-libre";

interface Props {
  readonly onJugar: (rivalId: string, modo: ModoJuego, jugadores?: readonly JugadorConfig[], todosVemosTodo?: boolean) => void;
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
  const [modo, setModo] = useState<ModoJuego>(MODO_POR_DEFECTO);
  // multi-setup-partida: de 1 a 4 humanos en el mismo dispositivo y el resto
  // de asientos (hasta 4 naves en total, mínimo 2) rellenado con rivales de IA.
  const [humanos, setHumanos] = useState(1);
  const [rivalesIA, setRivalesIA] = useState(1);
  // relevo-turno: solo se ofrece con 2 o más humanos; con uno no hay relevo.
  const [todosVemosTodo, setTodosVemosTodo] = useState(false);
  const [nombres, setNombres] = useState<readonly string[]>(["", "", "", ""]);
  const esMultijugador = humanos > 1 || rivalesIA > 1;
  const modoEfectivo: ModoJuego = modo;

  function elegirHumanos(cantidad: number): void {
    setHumanos(cantidad);
    setRivalesIA((actual) => Math.min(Math.max(actual, MIN_NAVES - cantidad), MAX_NAVES - cantidad));
  }

  function cambiarNombre(indice: number, texto: string): void {
    setNombres((actuales) => actuales.map((nombre, i) => (i === indice ? texto : nombre)));
  }

  function alJugar(): void {
    // Gesto real del usuario (el propio clic): el sitio legítimo para
    // desbloquear el AudioContext, igual que el pointerdown de Partida.ts
    // que sigue sirviendo de red de seguridad para gestos posteriores.
    desbloquearAudio();
    obtenerLocutor().iniciar();
    guardarRivalElegido(rivalId);
    // La partida de siempre (un humano sin nombre contra el rival elegido)
    // no pasa jugadores: conserva sus etiquetas "Tu nave" / nombre del rival.
    if (!esMultijugador && nombres[0].trim() === "") {
      onJugar(rivalId, modoEfectivo);
      return;
    }
    const indiceRival = Math.max(0, PERSONALIDADES.findIndex((personalidad) => personalidad.id === rivalId));
    const jugadores: JugadorConfig[] = [
      ...Array.from({ length: humanos }, (_vacio, i) => ({
        nombre: sanearNombre(nombres[i], `Jugador ${i + 1}`),
        tipo: "humano" as const,
      })),
      ...Array.from({ length: rivalesIA }, (_vacio, i) => {
        const personalidad = PERSONALIDADES[(indiceRival + i) % PERSONALIDADES.length];
        return { nombre: personalidad.nombre, tipo: "ia" as const, personalidadId: personalidad.id };
      }),
    ];
    onJugar(rivalId, modoEfectivo, jugadores, humanos > 1 && todosVemosTodo);
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

      <section
        data-testid="seccion-jugadores"
        style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 360 }}
      >
        <h2 style={{ margin: 0, fontSize: 15 }}>Jugadores</h2>
        <p data-testid="ayuda-multijugador" style={{ margin: 0, font: "12px system-ui, sans-serif" }}>
          Partida por turnos en el mismo dispositivo: de 1 a 4 personas se pasan el móvil, y los asientos que
          falten hasta dos naves (como mínimo) o cuatro (como máximo) los ocupan rivales de IA. Gana la última
          nave en pie.
        </p>
        <div role="group" aria-label="Jugadores humanos" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ flex: "0 0 74px", textAlign: "left" }}>Humanos</span>
          {[1, 2, 3, 4].map((cantidad) => (
            <button
              key={cantidad}
              type="button"
              data-testid={`humanos-${cantidad}`}
              aria-pressed={humanos === cantidad}
              onClick={() => elegirHumanos(cantidad)}
              style={{ ...botonCantidadEstilo, border: humanos === cantidad ? "2px solid #ffcc66" : botonEstilo.border }}
            >
              {cantidad}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Rivales de IA" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ flex: "0 0 74px", textAlign: "left" }}>Rivales IA</span>
          {[0, 1, 2, 3].map((cantidad) => {
            const disponible = cantidad >= MIN_NAVES - humanos && cantidad <= MAX_NAVES - humanos;
            return (
              <button
                key={cantidad}
                type="button"
                data-testid={`ias-${cantidad}`}
                aria-pressed={rivalesIA === cantidad}
                disabled={!disponible}
                onClick={() => setRivalesIA(cantidad)}
                style={{
                  ...botonCantidadEstilo,
                  opacity: disponible ? 1 : 0.35,
                  border: rivalesIA === cantidad ? "2px solid #ffcc66" : botonEstilo.border,
                }}
              >
                {cantidad}
              </button>
            );
          })}
        </div>
        {Array.from({ length: humanos }, (_vacio, i) => (
          <label key={i} style={{ display: "flex", gap: 8, alignItems: "center", textAlign: "left" }}>
            <span
              aria-hidden="true"
              style={{
                flex: "0 0 24px",
                height: 24,
                borderRadius: 12,
                background: `#${COLORES_NAVE[i].toString(16).padStart(6, "0")}`,
              }}
            />
            <input
              type="text"
              data-testid={`nombre-jugador-${i}`}
              aria-label={`Nombre del jugador ${i + 1}`}
              placeholder={`Jugador ${i + 1}`}
              maxLength={MAX_NOMBRE_JUGADOR}
              value={nombres[i]}
              onChange={(evento) => cambiarNombre(i, evento.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 36,
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(30,34,46,0.9)",
                color: "#e8eaf0",
                font: "14px system-ui, sans-serif",
              }}
            />
          </label>
        ))}
        {humanos > 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
              <input
                type="checkbox"
                data-testid="todos-vemos-todo"
                checked={todosVemosTodo}
                onChange={(evento) => setTodosVemosTodo(evento.target.checked)}
                style={{ width: 24, height: 24, flex: "0 0 24px" }}
              />
              <span>Todos vemos todo (sin pantalla de relevo)</span>
            </label>
            {todosVemosTodo && (
              <p role="status" data-testid="aviso-todos-vemos-todo" style={{ margin: 0, color: "#ffe08a", font: "12px system-ui, sans-serif" }}>
                Sin relevo, el turno pasa directo y lo que elige cada jugador (arma y ajuste) lo ve quien reciba el
                dispositivo: la información es pública.
              </p>
            )}
          </div>
        )}
        <p data-testid="resumen-asientos" style={{ margin: 0, font: "12px system-ui, sans-serif" }}>
          {humanos + rivalesIA} naves: {humanos} {humanos === 1 ? "humano" : "humanos"} y {rivalesIA}{" "}
          {rivalesIA === 1 ? "rival de IA" : "rivales de IA"}. Cada asiento tiene su color y su forma de nave.
        </p>
      </section>

      {rivalesIA > 0 && (
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
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 360 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Elige modo</h2>
        <button
          type="button"
          data-testid="modo-barra-libre"
          aria-pressed={modoEfectivo === "barra-libre"}
          onClick={() => setModo("barra-libre")}
          style={{
            ...botonEstilo,
            textAlign: "left",
            border: modoEfectivo === "barra-libre" ? "2px solid #ffcc66" : "1px solid rgba(255,255,255,0.25)",
          }}
        >
          <strong>Barra libre</strong>
          <br />
          <span style={{ font: "12px system-ui, sans-serif" }}>Todas las armas disponibles desde el primer turno, sin coste.</span>
        </button>
        <button
          type="button"
          data-testid="modo-presupuesto"
          aria-pressed={modoEfectivo === "presupuesto"}
          onClick={() => setModo("presupuesto")}
          style={{
            ...botonEstilo,
            textAlign: "left",
            border: modoEfectivo === "presupuesto" ? "2px solid #ffcc66" : "1px solid rgba(255,255,255,0.25)",
          }}
        >
          <strong>Con presupuesto</strong>
          <br />
          <span style={{ font: "12px system-ui, sans-serif" }}>
            Empiezas con {PRESUPUESTO_BASE} créditos y pagas cada arma al dispararla, según su daño y lo fácil
            que es acertar. Las tres gratis siempre están, pero hacen mucho menos daño.
          </span>
        </button>
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

const botonCantidadEstilo: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  padding: "8px 0",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(30,34,46,0.9)",
  color: "#e8eaf0",
  font: "15px system-ui, sans-serif",
  cursor: "pointer",
};

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
