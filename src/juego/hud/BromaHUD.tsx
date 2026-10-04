"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { obtenerBromas, suscribirBromas } from "@/juego/control/broma";

// hud-canales-1: la broma ahora vive en el canal PASIVO -- se desvanece sola
// entre 3 y 6 s sin que nadie la cierre (a diferencia del diseño de hum-1,
// que la dejaba fija hasta la siguiente). 5000 ms es un punto medio FIJO, no
// aleatorio, para que el e2e espere un plazo conocido en vez de sondear un
// rango (issue #151: nada de temporizadores que hagan el test flaky).
const DURACION_VISIBLE_MS = 5000;

export function BromaHUD() {
  const estado = useSyncExternalStore(suscribirBromas, obtenerBromas, obtenerBromas);
  // lay-4: la broma también se puede quitar de en medio a mano, con un
  // objetivo táctil de 44x44 -- comparar contra `clave` en vez de un
  // efecto+setState evita el re-render en cascada y hace innecesario
  // "reiniciar" nada a mano cuando llega una nueva.
  const [claveOculta, setClaveOculta] = useState<number | null>(null);

  useEffect(() => {
    const temporizador = setTimeout(() => setClaveOculta(estado.clave), DURACION_VISIBLE_MS);
    return () => clearTimeout(temporizador);
  }, [estado.clave]);

  if (!estado.disparo && !estado.impacto) return null;
  if (claveOculta === estado.clave) return null;

  return (
    <div
      data-testid="panel-bromas"
      style={{
        pointerEvents: "auto",
        position: "relative",
        // hud-canales-1 (quinta corrección): alignSelf (no alignItems del
        // padre) es lo que pega este panel al borde derecho de la columna de
        // fila-avisos.
        alignSelf: "flex-end",
        maxWidth: "74%",
        minWidth: 0,
        width: "100%",
        // hud-canales (décima corrección): flexShrink:0 (octava corrección)
        // dejaba a este panel fuera del reparto del flex de fila-avisos --
        // con su alto natural propio (hasta 78px) SUMADO al del aviso
        // (también visible en todo turno propio, hud-canales-5), el total
        // no cabía en los 78px fijos de fila-avisos, y aunque el overflow
        // de la fila lo recortara visualmente, su caja real
        // (getBoundingClientRect, no lo pintado) seguía midiendo su alto
        // natural completo y sobresalía por debajo del límite de la fila --
        // justo la caja que lay-3 medía solapada con selector-arma-abrir.
        // flexShrink por defecto (1) deja que el flex SÍ comprima este
        // panel, hasta minHeight (44, el mismo mínimo legible de siempre),
        // para que quepa junto al aviso en 78px sin excepción; el overflow
        // de abajo sigue siendo cómo se lee una broma larga que no entra en
        // el alto que le toque, nunca recortándola a media letra.
        minHeight: 44,
        maxHeight: 78,
        overflowY: "auto",
        boxSizing: "border-box",
        background: "rgba(10,12,20,0.78)",
        borderRadius: 8,
        padding: "4px 10px",
        paddingRight: 40,
      }}
    >
      {estado.disparo && (
        <div
          data-testid="broma-disparo-texto"
          role="status"
          style={{
            color: "#cfe8ff",
            font: "12px system-ui, sans-serif",
            textAlign: "center",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            // hud-canales (undécima corrección): disparo + impacto a la vez
            // (el caso normal, hum-1 garantiza que pasa en todo turno) pedían
            // hasta 83px de alto cuando el panel solo tiene 44 disponibles
            // si fila-avisos también muestra el aviso -- más alto que eso
            // rompía encuadre-movil-2 en la octava corrección. Recortar a
            // una línea con puntos suspensivos explícitos (en vez de dejar
            // que el overflow seccione el glifo a medias) es lo que hace que
            // el contenido quepa siempre en el mínimo del panel, sin
            // depender de cuánto sitio le quede libre en la fila.
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {estado.disparo}
        </div>
      )}
      {estado.impacto && (
        <div
          data-testid="broma-impacto-texto"
          data-categoria={estado.categoriaImpacto ?? undefined}
          role="status"
          style={{
            marginTop: estado.disparo ? 2 : 0,
            color: "#ffe08a",
            font: "13px system-ui, sans-serif",
            textAlign: "center",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {estado.impacto}
        </div>
      )}
      {/* hud-canales-4: superpuesto a la ESQUINA de este mismo fondo (no
          fuera de él, que era el "aspa solapada" del hallazgo anterior) --
          el padding-right de 40px le reserva sitio sin tapar el texto, y
          al no ser una fila aparte no suma su propio alto al panel. */}
      <button
        type="button"
        data-testid="broma-descartar"
        onClick={() => setClaveOculta(estado.clave)}
        aria-label="Descartar broma"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          minWidth: 44,
          minHeight: 44,
          background: "transparent",
          border: "none",
          color: "#cfe8ff",
          font: "14px system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}
