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
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        maxWidth: "74%",
        minWidth: 0,
        // hud-canales-4: ya no tiene maxHeight/overflow PROPIO del panel --
        // lo que antes se "cortaba" con scroll (el hallazgo del gatekeeper
        // anterior) era justo eso. Lo que SÍ queda acotado es cada frase por
        // separado (line-clamp a 2 líneas, más abajo): con texto aleatorio
        // del catálogo de humor, el hueco libre entre fila-avisos y
        // control-angulo en 360x640 es de apenas unas decenas de píxeles
        // (lay-3/lay-5 no dejan más margen), así que sin un tope por frase
        // una broma larga seguiría pudiendo solapar ángulo/potencia. Un
        // recorte de 2 líneas con "…" es la desviación declarada aquí frente
        // al diseño original (que no contemplaba límite de líneas): ver
        // `desviaciones` en el entregable.
      }}
    >
      <div
        style={{
          position: "relative",
          background: "rgba(10,12,20,0.78)",
          borderRadius: 8,
          padding: "4px 10px",
          paddingRight: 40,
          width: "100%",
          minHeight: 44,
          boxSizing: "border-box",
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
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
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
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
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
    </div>
  );
}
