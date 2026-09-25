"use client";

import { useEffect, useState } from "react";
import { JuegoLienzo } from "@/juego/JuegoLienzo";
import { PantallaInicio } from "@/juego/PantallaInicio";
import { elegirMapaDistinto, MAPA_POR_DEFECTO } from "@/juego/mundos/mapas";
import { suscribirOtraPartida } from "@/juego/control/parteDeGuerraStore";

type Fase = "inicio" | "jugando";

interface Partida {
  readonly clave: number;
  readonly mapaId: string;
  readonly personalidadId: string;
}

// partida-completa: dueño del recorrido completo (partida-1) -- decide
// cuándo se ve la pantalla de inicio y cuándo la partida real, y qué mundo
// le toca a cada una. `clave` fuerza un remonte COMPLETO de JuegoLienzo (y
// por tanto una instancia de Phaser.Game nueva) en cada "otra partida": es
// más simple y más robusto que añadir un método de reinicio a Partida.ts
// que tuviera que deshacer a mano cada pieza de estado de la escena
// anterior (naves, terreno, animadores, emisor de partículas...).
// ?mapa=<id> sigue funcionando como atajo determinista para los tests e2e
// de bloques anteriores (render-6, control-1...) que necesitan un mapa
// concreto (p.ej. deriva 0): se aplica solo a la PRIMERA partida de la
// sesión, "otra partida" siempre rota a un mundo distinto. Se lee en el
// inicializador de useState (no en un efecto) porque es el estado inicial
// de React sincronizándose UNA vez desde una fuente externa al montar, no
// una reacción a un cambio -- llamar a setState dentro de un efecto para
// esto dispara un render en cascada evitable (react-hooks/set-state-in-effect).
function mapaInicial(): string {
  if (typeof window === "undefined") return MAPA_POR_DEFECTO.id;
  return new URLSearchParams(window.location.search).get("mapa") ?? MAPA_POR_DEFECTO.id;
}

export function Aplicacion() {
  const [fase, setFase] = useState<Fase>("inicio");
  const [partida, setPartida] = useState<Partida>(() => ({
    clave: 0,
    mapaId: mapaInicial(),
    personalidadId: "la-contable",
  }));

  useEffect(() => {
    return suscribirOtraPartida(() => {
      setFase("jugando");
      setPartida((actual) => ({
        clave: actual.clave + 1,
        mapaId: elegirMapaDistinto(actual.mapaId).id,
        personalidadId: actual.personalidadId,
      }));
    });
  }, []);

  if (fase === "inicio") {
    return (
      <PantallaInicio
        onJugar={(rivalId) => {
          setPartida((actual) => ({ ...actual, personalidadId: rivalId }));
          setFase("jugando");
        }}
      />
    );
  }

  return (
    <JuegoLienzo
      key={partida.clave}
      datosEscena={{ mapaId: partida.mapaId, personalidadId: partida.personalidadId }}
    />
  );
}
