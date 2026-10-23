"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  alternarMusicaActiva,
  alternarSilenciado,
  alternarVozActiva,
  fijarRastroActivo,
  fijarSacudidaActiva,
  obtenerEstadoControl,
  suscribirControl,
} from "@/juego/control/store";
import { contarMensajes, obtenerBromas, suscribirBromas } from "@/juego/control/broma";
import { HistoricoBromasHUD } from "@/juego/hud/HistoricoBromasHUD";
import { obtenerDatosPwa, suscribirPwa, TEXTO_ESTADO_PWA, versionApp } from "@/juego/pwa/estadoPwa";
import "@/debug/tipos";
import { tamTexto } from "@/juego/hud/legibilidad";

const LADO_BOTON_PX = 48;
const ALTO_MINIMO_INTERRUPTOR_PX = 44;

const ESTILO_INTERRUPTOR: CSSProperties = {
  width: "100%",
  minHeight: ALTO_MINIMO_INTERRUPTOR_PX,
  padding: "0 10px",
  borderRadius: 8,
  border: "none",
  background: "var(--color-cromado-fondo)",
  color: "var(--color-cromado-texto)",
  font: `${tamTexto(14)} system-ui, sans-serif`,
  textAlign: "left",
  cursor: "pointer",
};

const ESTILO_AYUDA: CSSProperties = {
  margin: "2px 4px 0",
  color: "rgba(232,234,240,0.75)",
  font: `${tamTexto(14)}/1.3 system-ui, sans-serif`,
};

// Los cinco interruptores salieron de la consola (que se aparta en el vuelo y
// desaparece oculta o mínima) a este menú fijo: así Sonido sigue al alcance en
// cualquier momento y la fila superior solo lleva un botón. Es un disclosure,
// no un popover: tocar fuera NO lo cierra, porque en este juego un toque sobre
// el lienzo apunta y cerrar el menú no puede mover la mira.
export function MenuAjustesHUD() {
  const estado = useSyncExternalStore(suscribirControl, obtenerEstadoControl, obtenerEstadoControl);
  const pwa = useSyncExternalStore(suscribirPwa, obtenerDatosPwa, obtenerDatosPwa);
  const bromas = useSyncExternalStore(suscribirBromas, obtenerBromas, obtenerBromas);
  const [abierto, setAbierto] = useState(false);
  const [historicoAbierto, setHistoricoAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const idPanel = "panel-ajustes";
  const idBase = useId();
  // El botón Histórico se desmonta al abrir la hoja, así que el foco que la
  // hoja restaura se perdería: vuelve al botón de Ajustes, que sí sigue ahí.
  const cerrarHistorico = useCallback(() => {
    setHistoricoAbierto(false);
    boton.current?.focus();
  }, []);

  useEffect(() => {
    window.__debug = window.__debug ?? {};
    window.__debug.historico = { abierto: historicoAbierto, mensajes: contarMensajes(bromas.historico) };
  }, [historicoAbierto, bromas.historico]);

  // Cierra al pasar puedeDisparar de true a false (el disparo): el panel
  // taparía la trayectoria. Se ignora cualquier otro cambio del store.
  useEffect(() => {
    let previo = obtenerEstadoControl().puedeDisparar;
    return suscribirControl(() => {
      const actual = obtenerEstadoControl().puedeDisparar;
      if (previo && !actual) setAbierto(false);
      previo = actual;
    });
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (evento: KeyboardEvent): void => {
      if (evento.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  const vozEncendida = estado.vozActiva && estado.vozDisponible;
  const interruptores: ReadonlyArray<{
    testId: string;
    etiqueta: string;
    ayuda: string;
    pulsado: boolean;
    title: string;
    alPulsar: () => void;
    deshabilitado?: boolean;
  }> = [
    {
      testId: "toggle-sacudida",
      etiqueta: `Sacudida: ${estado.sacudidaActiva ? "On" : "Off"}`,
      ayuda: "Mueve la pantalla en los impactos",
      pulsado: estado.sacudidaActiva,
      title: estado.sacudidaActiva ? "Desactivar sacudida de impacto" : "Activar sacudida de impacto",
      alPulsar: () => fijarSacudidaActiva(!estado.sacudidaActiva),
    },
    {
      testId: "toggle-rastro",
      etiqueta: `Rastro: ${estado.rastroActivo ? "On" : "Off"}`,
      ayuda: "Dibuja la trayectoria del último tiro",
      pulsado: estado.rastroActivo,
      title: estado.rastroActivo ? "Ocultar el rastro del último tiro" : "Mostrar el rastro del último tiro",
      alPulsar: () => fijarRastroActivo(!estado.rastroActivo),
    },
    {
      // El gesto de pulsar este botón para activar el sonido es, a la vez, el
      // gesto de usuario que exige la política de autoplay (ver motor.ts).
      testId: "toggle-silenciado",
      etiqueta: `Sonido: ${estado.silenciado ? "Off" : "On"}`,
      ayuda: "Efectos de sonido del juego",
      pulsado: !estado.silenciado,
      title: estado.silenciado ? "Activar sonido" : "Silenciar",
      alPulsar: () => alternarSilenciado(),
    },
    {
      testId: "toggle-musica",
      etiqueta: `Música: ${estado.musicaActiva ? "Sí" : "No"}`,
      ayuda: "Banda sonora",
      pulsado: estado.musicaActiva,
      title: estado.musicaActiva ? "Quitar la música" : "Poner la música",
      alPulsar: () => alternarMusicaActiva(),
    },
    {
      testId: "toggle-voz",
      etiqueta: `Voz: ${vozEncendida ? "On" : "Off"}`,
      ayuda: "Lee los chistes en voz alta",
      pulsado: vozEncendida,
      title: !estado.vozDisponible
        ? (estado.avisoVoz ?? "Sin voz en castellano")
        : estado.vozActiva
          ? "Callar la voz de los chistes"
          : "Leer los chistes en voz alta",
      alPulsar: () => alternarVozActiva(),
      deshabilitado: !estado.vozDisponible,
    },
  ];

  return (
    <>
      <button
        ref={boton}
        type="button"
        data-testid="boton-ajustes"
        aria-label="Ajustes"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((valor) => !valor)}
        style={{
          position: "fixed",
          top: "calc(8px + env(safe-area-inset-top, 0px))",
          right: "calc(8px + env(safe-area-inset-right, 0px))",
          zIndex: 50,
          width: LADO_BOTON_PX,
          height: LADO_BOTON_PX,
          borderRadius: 12,
          border: "none",
          background: "var(--color-cromado-fondo)",
          color: "var(--color-cromado-texto)",
          font: `${tamTexto(24)} system-ui, sans-serif`,
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">⚙</span>
      </button>

      {abierto && (
        <div
          id={idPanel}
          data-testid="panel-ajustes"
          role="group"
          aria-label="Ajustes"
          style={{
            position: "fixed",
            top: `calc(${8 + LADO_BOTON_PX + 6}px + env(safe-area-inset-top, 0px))`,
            right: "calc(8px + env(safe-area-inset-right, 0px))",
            zIndex: 50,
            boxSizing: "border-box",
            width: "min(280px, calc(100vw - 16px))",
            maxHeight: "calc(100dvh - 140px)",
            overflowY: "auto",
            padding: 10,
            borderRadius: 12,
            background: "rgb(10,12,20)",
            border: "1px solid rgba(255,255,255,0.25)",
            color: "#e8eaf0",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <h2 style={{ margin: 0, font: `600 ${tamTexto(16)} system-ui, sans-serif` }}>Ajustes</h2>

          <div>
            <button
              type="button"
              data-testid="historico-bromas-toggle"
              aria-expanded={historicoAbierto}
              aria-describedby={`${idBase}-historico`}
              title="Abrir el histórico de mensajes"
              onClick={() => {
                setAbierto(false);
                setHistoricoAbierto(true);
              }}
              style={ESTILO_INTERRUPTOR}
            >
              Histórico{bromas.historico.length > 0 ? ` (${contarMensajes(bromas.historico)})` : ""}
            </button>
            <p id={`${idBase}-historico`} style={ESTILO_AYUDA}>
              Mensajes de la partida
            </p>
          </div>

          {interruptores.map((i) => (
            <div key={i.testId}>
              <button
                type="button"
                data-testid={i.testId}
                aria-pressed={i.pulsado}
                aria-describedby={`${idBase}-${i.testId}`}
                disabled={i.deshabilitado}
                title={i.title}
                onClick={i.alPulsar}
                style={{
                  ...ESTILO_INTERRUPTOR,
                  cursor: i.deshabilitado ? "not-allowed" : "pointer",
                  opacity: i.deshabilitado ? 0.6 : 1,
                }}
              >
                {i.etiqueta}
              </button>
              <p id={`${idBase}-${i.testId}`} style={ESTILO_AYUDA}>
                {i.ayuda}
              </p>
              {i.testId === "toggle-voz" && estado.avisoVoz !== null && (
                <div
                  data-testid="voz-aviso"
                  role="status"
                  style={{
                    marginTop: 6,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.25)",
                    font: `${tamTexto(14)}/1.3 system-ui, sans-serif`,
                  }}
                >
                  {estado.avisoVoz}
                </div>
              )}
            </div>
          ))}

          <div style={{ ...ESTILO_AYUDA, margin: "0 4px" }}>
            <div data-testid="estado-sin-conexion">{TEXTO_ESTADO_PWA[pwa.estado]}</div>
            <div data-testid="version-app">Versión {versionApp()}</div>
          </div>

          <button
            type="button"
            data-testid="cerrar-ajustes"
            onClick={() => {
              setAbierto(false);
              boton.current?.focus();
            }}
            style={{ ...ESTILO_INTERRUPTOR, textAlign: "center" }}
          >
            Cerrar
          </button>
        </div>
      )}

      {historicoAbierto && <HistoricoBromasHUD onCerrar={cerrarHistorico} />}
    </>
  );
}
