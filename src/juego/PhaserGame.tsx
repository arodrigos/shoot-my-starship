"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type Phaser from "phaser";
import { SinWebGL } from "@/juego/SinWebGL";
import { hayWebGL } from "@/juego/soporteWebGL";
import { ConsolaSuperpuesta } from "@/juego/hud/ConsolaSuperpuesta";
import { ReaccionHUD } from "@/juego/hud/ReaccionHUD";
import { ParteDeGuerraHUD } from "@/juego/hud/ParteDeGuerraHUD";
import { CuentaAtrasHUD } from "@/juego/hud/CuentaAtrasHUD";
import { PreparandoHUD } from "@/juego/hud/PreparandoHUD";
import { AyudaApuntadoHUD } from "@/juego/hud/AyudaApuntadoHUD";
import { publicarPreparando } from "@/juego/control/store";
import { RelevoHUD } from "@/juego/hud/RelevoHUD";
import { obtenerRelevo, suscribirRelevo } from "@/juego/control/relevoStore";
import type { DatosEscenaPartida, IdEscena } from "@/juego/main";

const ID_CONTENEDOR = "game-container";
type Estado = "disponible" | "sin-webgl";

interface Props {
  escena?: IdEscena;
  datosEscena?: DatosEscenaPartida;
}

// El estado inicial se calcula en el propio render, no en un efecto: este
// componente solo se monta en cliente (ver JuegoLienzo, dynamic ssr:false),
// así que `document` ya existe la primera vez que se ejecuta esta función y
// no hace falta esperar a un ciclo de efecto para saber si hay WebGL.
export function PhaserGame({ escena, datosEscena }: Props) {
  const [estado] = useState<Estado>(() => (hayWebGL() ? "disponible" : "sin-webgl"));
  const juego = useRef<Phaser.Game | null>(null);
  const relevoActivo = useSyncExternalStore(suscribirRelevo, () => obtenerRelevo().activo, () => false);

  useLayoutEffect(() => {
    if (estado !== "disponible") {
      return;
    }
    let cancelado = false;
    // Antes del primer pintado: el aviso tiene que estar ya en pantalla
    // cuando la escena empiece a colocar naves y bloquee el hilo.
    publicarPreparando(true);
    import("@/juego/main").then(({ iniciarJuego }) => {
      if (!cancelado) {
        juego.current = iniciarJuego(ID_CONTENEDOR, escena, datosEscena);
      }
    });
    return () => {
      cancelado = true;
      juego.current?.destroy(true);
      juego.current = null;
    };
    // datosEscena solo se lee al montar (el "key" del componente que envuelve
    // a JuegoLienzo es lo que fuerza un remonte completo para "otra partida" --
    // ver Aplicacion.tsx): incluirlo aquí recrearía el juego en cada
    // referencia nueva del objeto, que cambia en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, escena]);

  if (estado === "sin-webgl") {
    return <SinWebGL />;
  }

  const esPartida = (escena ?? "partida") === "partida";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* pantalla-completa: el lienzo ocupa el viewport entero y la consola
          es una capa encima (ver ConsolaSuperpuesta). */}
      <div
        id={ID_CONTENEDOR}
        data-testid="zona-juego"
        style={{ position: "absolute", inset: 0, minHeight: 0 }}
      />
      {/* El sandbox de terreno (/pruebas/terreno) no juega turnos -- el HUD
          de control no tiene nada que hacer ahí, así que tampoco reserva
          consola. */}
      {esPartida && (
        <>
          {/* relevo-turno: durante el relevo el control se desmonta (no solo
              se tapa) para que su saldo y arma seleccionada del jugador
              anterior no estén en el DOM del siguiente. */}
          {!relevoActivo && (
            <ConsolaSuperpuesta>
              <ReaccionHUD />
            </ConsolaSuperpuesta>
          )}
        </>
      )}
      {esPartida && <AyudaApuntadoHUD />}
      {esPartida && <PreparandoHUD />}
      {esPartida && <ParteDeGuerraHUD />}
      {esPartida && <CuentaAtrasHUD />}
      {esPartida && <RelevoHUD />}
    </div>
  );
}
