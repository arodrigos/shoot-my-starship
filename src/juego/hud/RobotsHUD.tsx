"use client";

import { useSyncExternalStore } from "react";
import { obtenerRobots, suscribirRobots } from "@/juego/control/robotsStore";

// minirobot (rob-2): una línea por robot vivo con su contador de saltos.
export function RobotsHUD() {
  const robots = useSyncExternalStore(suscribirRobots, obtenerRobots, obtenerRobots);
  if (robots.length === 0) return null;
  return (
    <>
      {robots.map((robot) => (
        <div
          key={robot.dueno}
          data-testid={`robot-${robot.dueno}`}
          role="status"
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--color-roce-fondo)",
            border: "1px solid var(--color-roce-borde)",
            borderRadius: 10,
            padding: "4px 10px",
            color: "var(--color-roce-texto)",
            font: "12px system-ui, sans-serif",
            pointerEvents: "none",
            flexShrink: 0,
          }}
        >
          {robot.texto}
        </div>
      ))}
    </>
  );
}
