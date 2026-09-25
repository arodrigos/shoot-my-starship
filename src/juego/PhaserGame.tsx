"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { SinWebGL } from "@/juego/SinWebGL";
import { hayWebGL } from "@/juego/soporteWebGL";
import { ControlHUD } from "@/juego/hud/ControlHUD";
import { ReaccionHUD } from "@/juego/hud/ReaccionHUD";
import { ParteDeGuerraHUD } from "@/juego/hud/ParteDeGuerraHUD";
import type { IdEscena } from "@/juego/main";

const ID_CONTENEDOR = "game-container";

type Estado = "disponible" | "sin-webgl";

interface Props {
  escena?: IdEscena;
}

// El estado inicial se calcula en el propio render, no en un efecto: este
// componente solo se monta en cliente (ver JuegoLienzo, dynamic ssr:false),
// así que `document` ya existe la primera vez que se ejecuta esta función y
// no hace falta esperar a un ciclo de efecto para saber si hay WebGL.
export function PhaserGame({ escena }: Props) {
  const [estado] = useState<Estado>(() => (hayWebGL() ? "disponible" : "sin-webgl"));
  const juego = useRef<Phaser.Game | null>(null);

  useLayoutEffect(() => {
    if (estado !== "disponible") {
      return;
    }
    let cancelado = false;
    import("@/juego/main").then(({ iniciarJuego }) => {
      if (!cancelado) {
        juego.current = iniciarJuego(ID_CONTENEDOR, escena);
      }
    });
    return () => {
      cancelado = true;
      juego.current?.destroy(true);
      juego.current = null;
    };
  }, [estado, escena]);

  if (estado === "sin-webgl") {
    return <SinWebGL />;
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div id={ID_CONTENEDOR} style={{ width: "100%", height: "100%" }} />
      {/* El sandbox de terreno (/pruebas/terreno) no juega turnos -- el HUD
          de control no tiene nada que hacer ahí. */}
      {(escena ?? "partida") === "partida" && (
        <>
          <ControlHUD />
          <ReaccionHUD />
          <ParteDeGuerraHUD />
        </>
      )}
    </div>
  );
}
