"use client";

import { memo, useEffect, useRef, useSyncExternalStore } from "react";
import { contarMensajes, obtenerBromas, suscribirBromas, type EntradaHistoricoBroma } from "@/juego/control/broma";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";
import { obtenerParticipantes, suscribirParticipantes } from "@/juego/control/participantesStore";
import { etiquetaDeNave } from "@/juego/hud/IntegridadHUD";
import { colorDeAsiento } from "@/juego/naves/paletaNaves";

const TAMANO_TACTIL_PX = 44;
const SELECTOR_FOCALIZABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

interface Props {
  readonly onCerrar: () => void;
}

// his-1..his-3: hoja inferior legible en vez de la tira de 48 px con scroll.
// En el móvil ocupa el ancho menos 16 px; en pantallas anchas se queda en
// 560 px centrada, que es lo que se lee cómodo con el pulgar y sin saltos.
function HistoricoBromasHUDSinMemo({ onCerrar }: Props) {
  const estado = useSyncExternalStore(suscribirBromas, obtenerBromas, obtenerBromas);
  const control = useSyncExternalStore(suscribirControl, obtenerEstadoControl, obtenerEstadoControl);
  const { participantes } = useSyncExternalStore(suscribirParticipantes, obtenerParticipantes, obtenerParticipantes);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // El foco vuelve a quien abrió la hoja: sin esto un usuario de teclado o
    // lector de pantalla se queda al principio del documento.
    const previo = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    return () => previo?.focus();
  }, []);

  // Esc a nivel de documento: el foco puede estar fuera de la hoja (p. ej. en
  // el botón que la abrió) y aun así debe cerrarla.
  useEffect(() => {
    const alEscape = (evento: KeyboardEvent): void => {
      if (evento.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alEscape);
    return () => document.removeEventListener("keydown", alEscape);
  }, [onCerrar]);

  function alTeclear(evento: React.KeyboardEvent<HTMLDivElement>): void {
    if (evento.key !== "Tab" || !panel.current) return;
    const focalizables = Array.from(panel.current.querySelectorAll<HTMLElement>(SELECTOR_FOCALIZABLE));
    if (focalizables.length === 0) return;
    const primero = focalizables[0];
    const ultimo = focalizables[focalizables.length - 1];
    const activo = document.activeElement;
    if (evento.shiftKey && (activo === primero || !panel.current.contains(activo))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && (activo === ultimo || !panel.current.contains(activo))) {
      evento.preventDefault();
      primero.focus();
    }
  }

  const nombreDe = (emisor: number): string => participantes?.[emisor]?.nombre ?? etiquetaDeNave(emisor, control.nombreRival);
  // Más reciente arriba, pero el índice del testid sigue el orden cronológico.
  const turnos = estado.historico.map((entrada, indice) => ({ entrada, indice })).reverse();

  return (
    <div
      data-testid="historico-bromas-fondo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
      style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(5,6,10,0.6)" }}
    >
      <div
        ref={panel}
        data-testid="historico-bromas"
        role="dialog"
        aria-modal="true"
        aria-labelledby="historico-bromas-titulo"
        onKeyDown={alTeclear}
        style={{
          position: "absolute",
          bottom: 8,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(calc(100vw - 16px), 560px)",
          height: "75vh",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          padding: 16,
          gap: 8,
          background: "rgba(14,16,24,0.97)",
          borderRadius: 12,
          // Fijo, no la variable de esquema: el fondo del panel es siempre oscuro
          // y en esquema claro la variable da texto casi negro (axe color-contrast).
          color: "#e8eaf0",
          font: "15px/1.4 system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h2 id="historico-bromas-titulo" style={{ margin: 0, font: "600 17px/1.4 system-ui, sans-serif" }}>
            Histórico ({contarMensajes(estado.historico)})
          </h2>
          <button
            type="button"
            data-testid="historico-bromas-cerrar"
            onClick={onCerrar}
            style={{
              minWidth: TAMANO_TACTIL_PX,
              minHeight: TAMANO_TACTIL_PX,
              padding: "0 12px",
              background: "transparent",
              border: "1px solid #cfe8ff",
              borderRadius: 8,
              color: "#cfe8ff",
              font: "15px system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
        <div
          role="log"
          tabIndex={0}
          aria-label="Mensajes de la partida"
          style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", wordBreak: "break-word", overflowWrap: "anywhere" }}
        >
          {turnos.length === 0 ? (
            <div data-testid="historico-bromas-vacio">
              Aún no hay mensajes: aquí aparecerán las bromas y avisos de la partida.
            </div>
          ) : (
            turnos.map(({ entrada, indice }) => (
              <section key={entrada.numeroTurno} data-testid={`historico-bromas-entrada-${indice}`} style={{ marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 4px", font: "600 13px/1.4 system-ui, sans-serif", color: "#b8c7da" }}>
                  Turno {entrada.numeroTurno + 1}
                </h3>
                {mensajesDe(entrada).map((texto, posicion) => (
                  <p key={posicion} data-testid="historico-bromas-mensaje" style={{ margin: "0 0 6px" }}>
                    <strong data-testid="historico-bromas-emisor" style={{ color: colorDeAsiento(entrada.emisor) }}>
                      {nombreDe(entrada.emisor)}:
                    </strong>{" "}
                    {texto}
                  </p>
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function mensajesDe(entrada: EntradaHistoricoBroma): string[] {
  return entrada.disparo ? [entrada.disparo, entrada.impacto] : [entrada.impacto];
}

// respuesta-200ms: se suscribe por su cuenta a las bromas, así que no necesita
// repintarse cada vez que el ángulo o la potencia hacen renderizar ControlHUD.
export const HistoricoBromasHUD = memo(HistoricoBromasHUDSinMemo);
