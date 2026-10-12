"use client";

import { useEffect, useSyncExternalStore } from "react";
import { colorDeAsiento } from "@/juego/naves/paletaNaves";
import { obtenerIntegridad, suscribirIntegridad } from "@/juego/control/integridadStore";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";
import { obtenerParticipantes, suscribirParticipantes } from "@/juego/control/participantesStore";
import { MAX_NOMBRE_JUGADOR } from "@/juego/jugadores";
import { acotarIntegridad, INTEGRIDAD_MAXIMA, porcentajeIntegridad } from "@/sim/naves/vida";

// imp-11: hasta este bloque no existía NINGÚN indicador de integridad en el
// HUD -- lo único que la reflejaba era el alfa del casco de la nave dentro
// del lienzo (Nave.ts), que no comunica ninguna cantidad ni es accesible.
// Barra con rol de progreso real (role=progressbar, aria-valuenow) para que
// un disparo que reduce integridad sea un hecho comprobable desde fuera del
// estado de depuración, no solo desde window.__debug.
// hud-canales-1: etiqueta por función, no por Record<0|1,string> -- el
// núcleo sigue teniendo solo dos naves hasta nucleo-n-naves, pero esta
// función ya no asume que `id` no pueda ser 2 o 3 (el hallazgo del
// gatekeeper era justo que una tercera nave no compilaba aquí).
export function etiquetaDeNave(id: number, nombreRival: string): string {
  if (id === 0) return "Tu nave";
  if (id === 1) return nombreRival;
  return `Nave ${id + 1}`;
}

// La fila de pestañas no pasa de unos 300 px ni siquiera en el iPad: con tres
// o cuatro naves quedan ~83 o ~63 px útiles por pestaña (medidos con el
// marcador de turno incluido). Un nombre que no cabe se abrevia quitando
// primero los títulos de delante («Almirante Bisagra» → «Bisagra», «La
// Contable» → «Contable») para que lo que queda se lea; solo si ni así cabe
// se corta con elipsis. El nombre completo queda para lectores de pantalla
// (span oculto) y para el title.
function maximoLetras(naves: number): number {
  return naves >= 4 ? 8 : naves === 3 ? 10 : MAX_NOMBRE_JUGADOR;
}

function cortar(texto: string, maximo: number): string {
  const letras = Array.from(texto);
  return letras.length <= maximo ? texto : `${letras.slice(0, maximo - 1).join("")}…`;
}

export function abreviarNombre(nombre: string, naves: number): string {
  const maximo = maximoLetras(naves);
  if (Array.from(nombre).length <= maximo) return nombre;
  const palabras = nombre.split(/\s+/).filter((p) => p !== "");
  // «Jugador 2»: el número es lo que distingue al jugador, así que se conserva.
  const numero = palabras.length > 1 && /^\d+$/.test(palabras[palabras.length - 1]!) ? palabras[palabras.length - 1]! : null;
  if (numero !== null) {
    const resto = palabras.slice(0, -1).join(" ");
    return `${cortar(resto, Math.max(3, maximo - numero.length - 1))} ${numero}`;
  }
  for (let i = 1; i < palabras.length; i++) {
    const candidato = palabras.slice(i).join(" ");
    if (Array.from(candidato).length >= 3 && Array.from(candidato).length <= maximo) return candidato;
  }
  return cortar(nombre, maximo);
}

// Con cuatro naves el marcador va pegado al nombre: cada letra cuenta.
function marcadorDeEstado(eliminada: boolean, esTurno: boolean, naves: number): string {
  const marca = eliminada ? "✖" : esTurno ? "▶" : "";
  return marca === "" || naves >= 4 ? marca : `${marca} `;
}

const SOLO_LECTORES: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

// hud-canales-1: ancho flexible (no 76px fijo) para que hasta cuatro barras
// se repartan el mismo hueco sin desbordarlo -- con 76px fijos, dos naves ya
// agotaban los ~156px disponibles en 360x640 y una tercera no cabía ni de
// casualidad (hallazgo del gatekeeper: harían falta 316px para cuatro).
const BARRA_ESTILO: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  borderRadius: 10,
  padding: "4px 6px",
  font: "12px system-ui, sans-serif",
  boxSizing: "border-box",
};

// hud-canales-1: el turno y el nombre del rival viven aquí (no en una fila
// nueva) porque esta fila ya agotaba casi todo el ancho y alto disponibles
// en 360x640 (338 de 344px, lay-5) -- resaltar la nave de quien juega y
// sustituir la etiqueta genérica por estado.nombreRival cuesta cero alto y
// cero ancho nuevos, a diferencia de una fila de turnos aparte.
// vida-color: el relleno de la barra lleva el color del asiento (el mismo
// que la nave dibujada y el histórico). El nombre NO: los colores de asiento
// no alcanzan 4,5:1 sobre el fondo claro del esquema claro (axe lo marcó) y
// axe no cuenta la sombra del texto.
const BORDE_BARRA = "1px solid #0b0f1a";
const DURACION_BAJADA_MS = 300;

function movimientoReducido(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function IntegridadHUD() {
  const estado = useSyncExternalStore(suscribirIntegridad, obtenerIntegridad, obtenerIntegridad);
  const control = useSyncExternalStore(suscribirControl, obtenerEstadoControl, obtenerEstadoControl);
  // multi-setup-partida: con jugadores configurados, el nombre de cada
  // asiento sustituye a las etiquetas de la partida de siempre.
  const { participantes } = useSyncExternalStore(suscribirParticipantes, obtenerParticipantes, obtenerParticipantes);

  // Gancho de depuración (como __debug.naves): lo que la barra pinta de
  // verdad, para que el e2e compare relleno y etiqueta sin leer píxeles.
  useEffect(() => {
    window.__debug = window.__debug ?? {};
    window.__debug.hud = {
      vidas: estado.naves.flatMap((nave) => {
        if (nave.integridad <= 0) return [];
        return [
          {
            id: nave.id,
            colorRelleno: colorDeAsiento(nave.id),
            etiqueta: participantes?.[nave.id]?.nombre ?? etiquetaDeNave(nave.id, control.nombreRival),
            valor: Math.round(acotarIntegridad(nave.integridad)),
            porcentaje: Math.round(porcentajeIntegridad(nave.integridad)),
          },
        ];
      }),
    };
  }, [estado, participantes, control.nombreRival]);
  const transicion = movimientoReducido() ? "none" : `width ${DURACION_BAJADA_MS}ms ease-out`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 4,
        width: "100%",
        minWidth: 0,
      }}
    >
      {estado.naves.map((nave) => {
        const valor = Math.round(acotarIntegridad(nave.integridad));
        const porcentaje = Math.round(porcentajeIntegridad(nave.integridad));
        const esTurno = control.turno === nave.id;
        const etiqueta = participantes?.[nave.id]?.nombre ?? etiquetaDeNave(nave.id, control.nombreRival);
        const eliminada = participantes !== null && nave.integridad <= 0;
        return (
          <div
            key={nave.id}
            style={{
              ...BARRA_ESTILO,
              position: "relative",
              padding: estado.naves.length >= 4 ? "4px 2px" : BARRA_ESTILO.padding,
              ...(estado.naves.length >= 4 ? { fontSize: 11 } : {}),
              background: esTurno ? "var(--color-roce-fondo)" : "var(--color-cromado-fondo)",
              color: esTurno ? "var(--color-roce-texto)" : "var(--color-cromado-texto)",
              border: esTurno ? "1px solid var(--color-roce-borde)" : "1px solid transparent",
            }}
            data-testid={`integridad-nave-${nave.id}`}
            title={eliminada ? `${etiqueta}: eliminada` : esTurno ? `${etiqueta}: turno` : etiqueta}
            aria-current={esTurno ? "true" : undefined}
          >
            <div
              data-testid={`integridad-etiqueta-${nave.id}`}
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}
            >
              {/* Con varios jugadores el estado va DELANTE del nombre: con cuatro
                  barras en 360 px el nombre largo se corta con puntos suspensivos y
                  un sufijo "turno" se perdería justo cuando más hace falta. */}
              {participantes ? marcadorDeEstado(eliminada, esTurno, estado.naves.length) : ""}
              <span aria-hidden="true">{abreviarNombre(etiqueta, estado.naves.length)}</span>
              <span style={SOLO_LECTORES}>{etiqueta}</span>
              {participantes ? "" : esTurno ? " · turno" : ""}
            </div>
            {nave.integridad > 0 ? (
              <div
                role="progressbar"
                aria-label={`Integridad de ${etiqueta}`}
                aria-valuemin={0}
                aria-valuemax={INTEGRIDAD_MAXIMA}
                aria-valuenow={valor}
                style={{
                  marginTop: 4,
                  height: 8,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.15)",
                  border: BORDE_BARRA,
                  boxSizing: "content-box",
                  overflow: "hidden",
                }}
              >
                <div
                  data-testid={`integridad-relleno-${nave.id}`}
                  style={{
                    width: `${porcentaje}%`,
                    height: "100%",
                    background: colorDeAsiento(nave.id),
                    transition: transicion,
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
