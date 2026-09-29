"use client";

import { useState, useSyncExternalStore } from "react";
import { obtenerBromas, suscribirBromas } from "@/juego/control/broma";

// Panel de bromas de humor-por-turno (hum-1): dos líneas independientes
// (disparo, impacto) que sustituyen su propio texto en cada turno -- a
// diferencia de ReaccionHUD (humor-sistemico), esto NO se autooculta con un
// temporizador: hum-1 exige que "aparece una frase tras cada disparo y otra
// tras cada impacto, sin excepción", así que la última frase de cada tipo se
// queda visible hasta que la siguiente la sustituye, en vez de desaparecer
// antes de que e2e (o Adrián) llegue a leerla.
export function BromaHUD() {
  const estado = useSyncExternalStore(suscribirBromas, obtenerBromas, obtenerBromas);
  // lay-4: la broma se puede quitar de en medio con un objetivo táctil de
  // 44x44 (el botón de más abajo), y vuelve a aparecer sola en cuanto llega
  // una nueva -- comparar contra `clave` en vez de un efecto+setState evita
  // el re-render en cascada y hace innecesario "reiniciar" nada a mano.
  const [claveDescartada, setClaveDescartada] = useState<number | null>(null);

  if (!estado.disparo && !estado.impacto) return null;
  if (claveDescartada === estado.clave) return null;

  return (
    <div
      data-testid="panel-bromas"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "center",
        // lay-3: reparte el ancho de la fila con RoceHUD por flex, no por un
        // 48% fijo -- así cuando no hay roce (el caso normal), la broma usa
        // TODA la fila y necesita muchas menos líneas para el mismo texto,
        // en vez de quedarse partida a la mitad sin motivo.
        flex: "1 1 0",
        minWidth: 0,
        // lay-3/lay-4: el propio recuadro (no solo el de su fila) tiene que
        // quedarse dentro del hueco reservado -- overflow en el padre no
        // recorta el propio bounding box del panel, así que el límite va
        // aquí para que una broma larga jamás alcance geométricamente la
        // fila de abajo.
        maxHeight: 70,
        overflowY: "auto",
      }}
    >
      {estado.disparo && (
        <div
          data-testid="broma-disparo-texto"
          role="status"
          style={{
            background: "rgba(10,12,20,0.72)",
            color: "#cfe8ff",
            borderRadius: 8,
            padding: "4px 10px",
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
            background: "rgba(10,12,20,0.78)",
            color: "#ffe08a",
            borderRadius: 8,
            padding: "5px 12px",
            font: "13px system-ui, sans-serif",
            textAlign: "center",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {estado.impacto}
        </div>
      )}
      <button
        type="button"
        data-testid="broma-descartar"
        onClick={() => setClaveDescartada(estado.clave)}
        aria-label="Descartar broma"
        style={{
          position: "absolute",
          top: -8,
          right: -8,
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
