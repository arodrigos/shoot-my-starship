"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { ControlHUD } from "@/juego/hud/ControlHUD";
import { obtenerEstadoControl, suscribirControl } from "@/juego/control/store";
import {
  CLAVE_ANCLAJE_CONSOLA,
  CLAVE_ESTADO_CONSOLA,
  CLAVE_PLEGADA_ANTIGUA,
  sanearAnclajeConsola,
  sanearEstadoConsola,
  siguienteAnclaje,
  type AnclajeConsola,
  type EstadoConsola,
} from "@/juego/hud/estadoConsola";
import "@/debug/tipos";

// consola-compacta: el 40 % del ancho con un mínimo de 320 px (que cabe en el
// móvil más estrecho) y, como mucho, el viewport menos 8 px por lado.
const ANCHO_CONSOLA = "clamp(320px, 40vw, calc(100vw - 16px))";
const ALTO_MAXIMO_DESPLEGADA = "40%";
const ALTO_MINIMA_PX = 64;
const LADO_PESTANA_PX = 48;
const MARGEN_LATERAL_PX = 8;
const FONDO_DESPLEGADA = "rgba(10, 12, 20, 0.55)";

function leerAlmacenado(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string): void {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado) el valor vale solo para esta partida.
  }
}

// Sin transform: ControlHUD lleva elementos position:fixed (histórico, ayuda)
// y un ancestro con transform los ataría a la consola en vez de al viewport.
function posicionHorizontal(anclaje: AnclajeConsola): CSSProperties {
  if (anclaje === "abajo-izquierda") return { left: MARGEN_LATERAL_PX };
  if (anclaje === "abajo-derecha") return { right: MARGEN_LATERAL_PX };
  return { left: 0, right: 0, marginLeft: "auto", marginRight: "auto" };
}

interface Props {
  readonly children?: ReactNode;
}

export function ConsolaSuperpuesta({ children }: Props) {
  const [estado, setEstado] = useState<EstadoConsola>(() =>
    sanearEstadoConsola(leerAlmacenado(CLAVE_ESTADO_CONSOLA), leerAlmacenado(CLAVE_PLEGADA_ANTIGUA)),
  );
  const [anclaje, setAnclaje] = useState<AnclajeConsola>(() => sanearAnclajeConsola(leerAlmacenado(CLAVE_ANCLAJE_CONSOLA)));
  const puedeDisparar = useSyncExternalStore(suscribirControl, () => obtenerEstadoControl().puedeDisparar, () => false);

  useEffect(() => {
    window.__debug = window.__debug ?? {};
    window.__debug.consola = { estado, anclaje };
  }, [estado, anclaje]);

  function cambiarEstado(nuevo: EstadoConsola): void {
    guardar(CLAVE_ESTADO_CONSOLA, nuevo);
    setEstado(nuevo);
  }

  function mover(): void {
    const nuevo = siguienteAnclaje(anclaje);
    guardar(CLAVE_ANCLAJE_CONSOLA, nuevo);
    setAnclaje(nuevo);
  }

  const oculta = estado === "oculta";
  const minima = estado === "minima";
  // Durante el vuelo (y el turno del rival) la capa se aparta para no tapar la
  // trayectoria. Se hace con opacidad y sin eventos, no desmontando: el estado
  // del HUD sigue en el DOM y vuelve exactamente igual al terminar el turno.
  const apartada = !puedeDisparar;

  const base: CSSProperties = {
    position: "absolute",
    bottom: 0,
    zIndex: 5,
    ...posicionHorizontal(anclaje),
    opacity: apartada && !oculta ? 0.0 : 1,
    pointerEvents: apartada && !oculta ? "none" : "auto",
    transition: "opacity 120ms linear",
  };

  // Oculta: el contenedor mide lo que la pestaña, así que no queda ningún
  // rectángulo que tape el lienzo. El HUD sigue montado (display:none) para
  // no perder su estado.
  const geometria: CSSProperties = oculta
    ? {
        width: LADO_PESTANA_PX,
        height: LADO_PESTANA_PX,
        marginBottom: `calc(${MARGEN_LATERAL_PX}px + env(safe-area-inset-bottom, 0px))`,
      }
    : {
        width: ANCHO_CONSOLA,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: minima ? "transparent" : FONDO_DESPLEGADA,
        ...(minima ? { height: `calc(${ALTO_MINIMA_PX}px + env(safe-area-inset-bottom, 0px))` } : { maxHeight: ALTO_MAXIMO_DESPLEGADA }),
      };

  return (
    <div
      data-testid="consola"
      data-estado={estado}
      data-anclaje={anclaje}
      data-plegada={minima ? "true" : "false"}
      data-oculta={apartada ? "true" : "false"}
      style={{ ...base, ...geometria }}
    >
      {oculta && (
        <button
          type="button"
          data-testid="pestana-consola"
          aria-label="Mostrar controles"
          title="Mostrar controles"
          onClick={() => cambiarEstado("desplegada")}
          style={{
            width: LADO_PESTANA_PX,
            height: LADO_PESTANA_PX,
            border: "none",
            borderRadius: 12,
            background: "rgba(10, 12, 20, 0.85)",
            color: "#e8eaf0",
            font: "20px system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true">▴</span>
        </button>
      )}
      <div style={oculta ? { display: "none" } : { position: "relative", height: minima ? "100%" : undefined }}>
        <ControlHUD
          plegada={minima}
          alAlternarPlegado={() => cambiarEstado(minima ? "desplegada" : "minima")}
          alOcultar={() => cambiarEstado("oculta")}
          alMover={mover}
        />
        {children}
      </div>
    </div>
  );
}
