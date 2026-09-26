"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import {
  actualizarArrastre,
  ajustarAnguloFino,
  armaEstaAgotada,
  cerrarAyuda,
  iniciarArrastre,
  obtenerEstadoControl,
  repetirUltimoDisparo,
  seleccionarArma,
  solicitarDisparo,
  suscribirControl,
  terminarArrastre,
} from "@/juego/control/store";
import { obtenerResultadoTurno, suscribirResultadoTurno } from "@/juego/control/resultadoTurnoStore";
import "@/debug/tipos";

// La cáscara React del control (fuera del lienzo, ver arquitectura): todo lo
// de aquí es matemática de pantalla o de UI, nunca de terreno -- si algo
// necesitase saber dónde está el suelo, iría dentro de Partida.ts, no aquí.
// esp-4: 44px (WCAG 2.2 SC 2.5.5), no los 24px de SC 2.5.8 que ya cubre
// control-2 -- este hito exige el umbral más alto para los controles que de
// verdad se disparan con el pulgar en 360x640.
const TAMANO_MINIMO_BOTON_PX = 44;

function fraccionDeVentana(clienteX: number, clienteY: number): { x: number; y: number } {
  return { x: clienteX / window.innerWidth, y: clienteY / window.innerHeight };
}

function trayectoriaPreviaSVG(anguloGrados: number, potencia: number): string {
  const rad = (anguloGrados * Math.PI) / 180;
  const escala = (potencia / 100) * 60;
  const puntos: string[] = [];
  const pasos = 12;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = 4 + t * escala * Math.cos(rad);
    const y = 56 - (t * escala * Math.sin(rad) - 0.5 * 9.8 * t * t * (escala / 30));
    puntos.push(`${x.toFixed(1)},${Math.max(2, Math.min(56, y)).toFixed(1)}`);
  }
  return puntos.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(" ");
}

export function ControlHUD() {
  const estado = useSyncExternalStore(suscribirControl, obtenerEstadoControl, obtenerEstadoControl);
  const resultadoTurno = useSyncExternalStore(suscribirResultadoTurno, obtenerResultadoTurno, obtenerResultadoTurno);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  useEffect(() => {
    window.__debug = window.__debug ?? {};
    window.__debug.control = {
      ajuste: estado.ajuste,
      ultimoDisparo: estado.ultimoDisparo,
      puedeDisparar: estado.puedeDisparar,
      ayudaVisible: estado.ayudaVisible,
      usosPorArma: estado.usosPorArma,
    };
    window.__debug.modoEspacial = estado.modoEspacial;
  }, [estado]);

  useEffect(() => {
    window.__debug = window.__debug ?? {};
    window.__debug.resultadoTurno = resultadoTurno.texto;
  }, [resultadoTurno]);

  const armaSeleccionada = CATALOGO_ARMAS.find((arma) => arma.id === estado.ajuste.armaId) ?? CATALOGO_ARMAS[0];

  function alPuntoDeArrastre(evento: React.PointerEvent<HTMLDivElement>): void {
    if (evento.clientY / window.innerHeight < 0.5) return;
    (evento.target as HTMLElement).setPointerCapture(evento.pointerId);
    iniciarArrastre(fraccionDeVentana(evento.clientX, evento.clientY));
  }

  function alMoverArrastre(evento: React.PointerEvent<HTMLDivElement>): void {
    if (evento.buttons === 0) return;
    actualizarArrastre(fraccionDeVentana(evento.clientX, evento.clientY));
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1, touchAction: "none", userSelect: "none" }}
      onPointerDown={alPuntoDeArrastre}
      onPointerMove={alMoverArrastre}
      onPointerUp={terminarArrastre}
      onPointerCancel={terminarArrastre}
      data-testid="superficie-arrastre"
    >
      <div
        role="status"
        data-testid="resultado-turno"
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: 10,
          maxWidth: 160,
          background: "var(--color-cromado-fondo)",
          borderRadius: 10,
          padding: "6px 10px",
          color: "var(--color-cromado-texto)",
          font: "11px system-ui, sans-serif",
        }}
      >
        {resultadoTurno.texto}
      </div>

      <div
        style={{
          position: "fixed",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          background: "var(--color-cromado-fondo)",
          borderRadius: 10,
          padding: "6px 10px",
          color: "var(--color-cromado-texto)",
          font: "12px system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <svg width={60} height={60} viewBox="0 0 60 60" data-testid="reticulo">
          <circle cx={30} cy={56} r={2} fill="#5ac8fa" />
          <line
            x1={30}
            y1={56}
            x2={30 + 26 * Math.cos((estado.ajuste.anguloGrados * Math.PI) / 180)}
            y2={56 - 26 * Math.sin((estado.ajuste.anguloGrados * Math.PI) / 180)}
            stroke="#ff6b4a"
            strokeWidth={3}
          />
          <path
            d={trayectoriaPreviaSVG(estado.ajuste.anguloGrados, estado.ajuste.potencia)}
            fill="none"
            stroke="#ffcc66"
            strokeWidth={2}
            strokeDasharray="3 3"
            data-testid="preview-trayectoria"
          />
        </svg>
        <div>
          {estado.ajuste.anguloGrados.toFixed(1)}° · {Math.round(estado.ajuste.potencia)}%
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          type="button"
          data-testid="paso-angulo-mas"
          onClick={() => ajustarAnguloFino(1)}
          style={botonEstilo}
        >
          +0.1°
        </button>
        <button
          type="button"
          data-testid="paso-angulo-menos"
          onClick={() => ajustarAnguloFino(-1)}
          style={botonEstilo}
        >
          -0.1°
        </button>
      </div>

      <div
        style={{
          position: "fixed",
          left: 10,
          bottom: 10,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 220,
        }}
      >
        <button
          type="button"
          data-testid="selector-arma-abrir"
          onClick={() => setSelectorAbierto((valor) => !valor)}
          style={botonEstilo}
        >
          {armaSeleccionada.nombre}
        </button>
        {selectorAbierto && (
          <div
            style={{
              background: "var(--color-cromado-fondo)",
              borderRadius: 8,
              padding: 6,
              maxHeight: 260,
              overflowY: "auto",
              color: "var(--color-cromado-texto)",
              font: "12px system-ui, sans-serif",
            }}
          >
            {CATALOGO_ARMAS.map((arma) => {
              const agotada = armaEstaAgotada(arma.id);
              return (
                <button
                  key={arma.id}
                  type="button"
                  data-testid={`arma-${arma.id}`}
                  disabled={agotada}
                  onClick={() => {
                    seleccionarArma(arma.id);
                    setSelectorAbierto(false);
                  }}
                  style={{
                    ...botonEstilo,
                    width: "100%",
                    minHeight: TAMANO_MINIMO_BOTON_PX,
                    textAlign: "left",
                    opacity: agotada ? 0.45 : 1,
                    marginBottom: 4,
                  }}
                >
                  <strong>{arma.nombre}</strong>
                  {agotada ? " (agotada)" : ""}
                  <br />
                  <span>{arma.descripcion}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ position: "fixed", right: 10, bottom: 10, zIndex: 10, display: "flex", gap: 8 }}>
        <button
          type="button"
          data-testid="repetir-disparo"
          onClick={repetirUltimoDisparo}
          disabled={!estado.ultimoDisparo}
          style={botonEstilo}
        >
          Repetir
        </button>
        <button
          type="button"
          data-testid="disparar"
          onClick={solicitarDisparo}
          disabled={!estado.puedeDisparar}
          style={{ ...botonEstilo, background: "#ff6b4a", minWidth: 88 }}
        >
          Disparar
        </button>
      </div>

      {estado.ayudaVisible && (
        <div
          role="alert"
          data-testid="ayuda-inicial"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-cromado-fondo)",
            color: "var(--color-cromado-texto)",
            font: "14px system-ui, sans-serif",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 320 }}>
            <p>
              Arrastra en la mitad inferior de la pantalla para apuntar: el retículo de arriba se mueve con tu
              gesto, sin que el dedo lo tape. Usa +0.1°/-0.1° para el ajuste fino, elige arma y pulsa Disparar.
            </p>
            {estado.modoEspacial && (
              <p data-testid="ayuda-espacial">
                Los planetas curvan la trayectoria de tu disparo -- apunta pensando en su tirón, no en línea recta.
                Un disparo puede quedarse en órbita y perderse: si pasa, el turno sigue igual.
              </p>
            )}
            <button type="button" data-testid="ayuda-cerrar" onClick={cerrarAyuda} style={botonEstilo}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const botonEstilo: React.CSSProperties = {
  minWidth: TAMANO_MINIMO_BOTON_PX,
  minHeight: TAMANO_MINIMO_BOTON_PX,
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-cromado-borde)",
  background: "var(--color-cromado-boton)",
  color: "var(--color-cromado-texto)",
  font: "12px system-ui, sans-serif",
  cursor: "pointer",
};
