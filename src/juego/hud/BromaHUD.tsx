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
        // hud-canales-1 (quinta corrección): fila-avisos pasó de fila a
        // columna -- alignSelf (no alignItems del padre) es lo que sigue
        // pegando este panel al borde derecho dentro de esa columna, ahora
        // que ya no comparte ancho con roce ni con el aviso.
        alignSelf: "flex-end",
        maxWidth: "74%",
        minWidth: 0,
        // hud-canales (octava corrección): minHeight:0 (séptima corrección)
        // evitaba el solape con selector-arma-abrir comprimiendo este panel
        // por debajo de su propio contenido -- pero esa compresión es
        // justo lo que dejaba clientHeight por debajo de scrollHeight y
        // cortaba la broma a media letra, con el aviso ocupando sitio a la
        // vez. El sitio que faltaba ahora lo da fila-avisos (78 -> 96px),
        // así que este panel vuelve a flexShrink:0: mantiene su propio
        // alto (hasta el maxHeight de abajo) sin que el flex lo comprima, y
        // si de verdad no cabe (caso extremo, no el normal) es fila-avisos
        // quien se desplaza con su propio overflowY, nunca este panel
        // recortando a medias.
        flexShrink: 0,
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
          // hud-canales (corrección): el recorte por línea (WebkitLineClamp:2)
          // cortaba la broma a media frase (hallazgo del gatekeeper: "…toda mi
          // confianza y ni un gramo de mi…") porque el catálogo de humor tiene
          // frases de hasta 291 caracteres, muchas más de las 2 líneas que
          // caben a 12-13px de ancho de panel. El tope es de ALTO sobre el
          // panel entero, con scroll propio -- el mensaje se puede leer
          // entero desplazándose, nunca se pierde media frase sin aviso.
          // hud-canales-1 (sexta corrección): 96px se salía del propio tope
          // de fila-avisos (78px, lo que de verdad cabe en la consola a
          // 360x640) -- la caja de este panel, aunque se recortara visualmente
          // por el overflow del padre, seguía midiendo 96px de alto para
          // getBoundingClientRect, y ese sobrante de 18px es justo lo que
          // lay-3 medía solapado con selector-arma-abrir. 78px iguala el
          // propio tope del padre: la frase más larga sigue entera, solo que
          // alcanzable con scroll en vez de con margen de sobra.
          maxHeight: 78,
          overflowY: "auto",
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
