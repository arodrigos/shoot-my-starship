"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import {
  actualizarArrastre,
  ajustarAnguloFino,
  armaEstaAgotada,
  cerrarAyuda,
  costeDeArma,
  iniciarArrastre,
  obtenerEstadoControl,
  puedeCostearArma,
  repetirUltimoDisparo,
  seleccionarArma,
  solicitarDisparo,
  suscribirControl,
  terminarArrastre,
} from "@/juego/control/store";
import { obtenerResultadoTurno, suscribirResultadoTurno } from "@/juego/control/resultadoTurnoStore";
import { IntegridadHUD } from "@/juego/hud/IntegridadHUD";
import { BromaHUD } from "@/juego/hud/BromaHUD";
import { RoceHUD } from "@/juego/hud/RoceHUD";
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
    // layout-dos-zonas: la consola entera (ya separada del lienzo, ver
    // PhaserGame) es la superficie de apuntado -- ya no hace falta el filtro
    // por mitad de pantalla que existía cuando el HUD flotaba sobre el juego.
    (evento.target as HTMLElement).setPointerCapture(evento.pointerId);
    iniciarArrastre(fraccionDeVentana(evento.clientX, evento.clientY));
  }

  function alMoverArrastre(evento: React.PointerEvent<HTMLDivElement>): void {
    if (evento.buttons === 0) return;
    actualizarArrastre(fraccionDeVentana(evento.clientX, evento.clientY));
  }

  const enPresupuesto = estado.modo === "presupuesto";
  const saldoInsuficienteParaSeleccionada = enPresupuesto && !puedeCostearArma(armaSeleccionada.id);
  const potenciaEnCero = Math.round(estado.ajuste.potencia) <= 0;
  // lay-6: motivo concreto de por qué "Disparar" no responde -- distinto de
  // puedeDisparar (que gobierna la escena: turno, animación en curso...) y
  // que por eso necesita su propio texto en vez de reusar el de la escena.
  const avisoAccionImposible = potenciaEnCero
    ? "Potencia a 0: arrastra hacia arriba en la consola para cargar el disparo."
    : saldoInsuficienteParaSeleccionada
      ? `Saldo insuficiente para ${armaSeleccionada.nombre}: elige otra arma o acierta un disparo para ingresar.`
      : null;

  return (
    // layout-dos-zonas: esta consola ocupa el 100% de su contenedor (la
    // franja inferior de PhaserGame, ya separada del lienzo) en un flujo
    // normal de filas -- nada de position:fixed disperso por el viewport,
    // que era justo lo que producía los solapes que este bloque corrige.
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        touchAction: "none",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        // lay-3: "space-evenly" reparte el espacio libre EN NEGATIVO cuando
        // el contenido (p.ej. una broma real de dos líneas largas) no cabe
        // en el alto fijo de la consola -- eso separaba las filas con un
        // hueco negativo y las hacía solaparse de verdad (medido: el panel
        // de bromas empezaba antes de que terminase la fila del retículo).
        // "flex-start" + el `gap` fijo de abajo nunca produce huecos
        // negativos: si el contenido no cabe, se desborda hacia el scroll
        // de la consola (overflowY:auto), nunca hacia el solape.
        justifyContent: "flex-start",
        padding: "4px 8px",
        gap: 4,
        boxSizing: "border-box",
      }}
      onPointerDown={alPuntoDeArrastre}
      onPointerMove={alMoverArrastre}
      onPointerUp={terminarArrastre}
      onPointerCancel={terminarArrastre}
      data-testid="superficie-arrastre"
    >
      {/* fila-estado: resultado del turno (+ saldo, en modo presupuesto) a la
          izquierda, integridad de ambas naves a la derecha. */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "56%", minWidth: 0 }}>
          <div
            role="status"
            data-testid="resultado-turno"
            style={{
              background: "var(--color-cromado-fondo)",
              borderRadius: 10,
              padding: "6px 10px",
              color: "var(--color-cromado-texto)",
              font: "11px system-ui, sans-serif",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {resultadoTurno.texto}
          </div>
          {enPresupuesto && (
            <div
              data-testid="saldo"
              style={{
                background: "var(--color-cromado-fondo)",
                borderRadius: 10,
                padding: "4px 10px",
                color: "var(--color-cromado-texto)",
                font: "12px system-ui, sans-serif",
              }}
            >
              Saldo: {estado.saldo ?? 0} cr
            </div>
          )}
        </div>
        <IntegridadHUD />
      </div>

      {/* fila-mira: retículo, previsualización de trayectoria y lectura de
          ángulo/potencia, centrados. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "var(--color-cromado-fondo)",
          borderRadius: 10,
          padding: "4px 10px",
          color: "var(--color-cromado-texto)",
          font: "12px system-ui, sans-serif",
          alignSelf: "center",
        }}
      >
        <svg width={48} height={48} viewBox="0 0 60 60" data-testid="reticulo">
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

      {/* fila-avisos: hueco reservado de broma (izquierda) y roce (derecha) --
          lay-4 pide el hueco reservado literalmente: altura FIJA (no
          mínima) y con scroll propio si una frase larga no cabe, para que
          quitar la broma nunca mueva el resto de controles y para que un
          texto largo jamás empuje ni solape la fila de abajo (lay-3). */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 6,
          height: 90,
          overflowY: "auto",
        }}
      >
        <BromaHUD />
        <RoceHUD />
      </div>

      {/* fila-armas: selector de arma, paso fino de ángulo y disparo/repetir. */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <div style={{ position: "relative", minWidth: 0, flex: "0 1 auto" }}>
          <button
            type="button"
            data-testid="selector-arma-abrir"
            onClick={() => setSelectorAbierto((valor) => !valor)}
            style={{
              ...botonEstilo,
              maxWidth: 128,
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              lineHeight: 1.15,
            }}
          >
            {armaSeleccionada.nombre}
          </button>
          {selectorAbierto && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                left: 0,
                zIndex: 20,
                width: 220,
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
                const coste = costeDeArma(arma.id);
                const asequible = puedeCostearArma(arma.id);
                const faltan = enPresupuesto && !asequible ? coste - (estado.saldo ?? 0) : 0;
                return (
                  <button
                    key={arma.id}
                    type="button"
                    data-testid={`arma-${arma.id}`}
                    disabled={agotada || !asequible}
                    onClick={() => {
                      seleccionarArma(arma.id);
                      setSelectorAbierto(false);
                    }}
                    style={{
                      ...botonEstilo,
                      width: "100%",
                      minHeight: TAMANO_MINIMO_BOTON_PX,
                      textAlign: "left",
                      opacity: agotada || !asequible ? 0.45 : 1,
                      marginBottom: 4,
                    }}
                  >
                    <strong>{arma.nombre}</strong>
                    {agotada ? " (agotada)" : ""}
                    {enPresupuesto && <span data-testid={`precio-${arma.id}`}>{coste > 0 ? ` — ${coste} cr` : " — Gratis"}</span>}
                    <br />
                    <span>{arma.descripcion}</span>
                    {faltan > 0 && (
                      <>
                        <br />
                        <span data-testid={`saldo-insuficiente-${arma.id}`} style={{ color: "#ffcc66" }}>
                          Te faltan {faltan} créditos: dispara una gratis o acierta para ingresar.
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
          <button type="button" data-testid="paso-angulo-mas" onClick={() => ajustarAnguloFino(1)} style={botonEstilo}>
            +0.1°
          </button>
          <button type="button" data-testid="paso-angulo-menos" onClick={() => ajustarAnguloFino(-1)} style={botonEstilo}>
            -0.1°
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 6 }}>
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
      </div>

      {avisoAccionImposible && (
        <div
          role="status"
          data-testid="aviso-accion-imposible"
          style={{
            position: "absolute",
            bottom: 4,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "92%",
            background: "rgba(255,107,74,0.16)",
            border: "1px solid rgba(255,107,74,0.6)",
            borderRadius: 8,
            padding: "4px 10px",
            color: "var(--color-cromado-texto)",
            font: "11px system-ui, sans-serif",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {avisoAccionImposible}
        </div>
      )}

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
              Arrastra en cualquier punto de la consola para apuntar: el retículo de arriba se mueve con tu
              gesto, sin que el dedo lo tape. Usa +0.1°/-0.1° para el ajuste fino, elige arma y pulsa Disparar.
            </p>
            {estado.modoEspacial && (
              <p data-testid="ayuda-espacial">
                Los planetas curvan la trayectoria de tu disparo -- apunta pensando en su tirón, no en línea recta.
                Un disparo puede quedarse en órbita y perderse: si pasa, el turno sigue igual.
              </p>
            )}
            <p data-testid="explicacion-modo">
              {estado.modo === "presupuesto"
                ? `Modo con presupuesto: empiezas con ${estado.saldo ?? 0} créditos, cada disparo cuesta el suyo y acertar ingresa por el daño causado. Tres armas son siempre gratis.`
                : "Modo barra libre: todas las armas están disponibles siempre, sin coste."}
            </p>
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
