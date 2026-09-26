"use client";

import { useEffect, useState } from "react";
import { JuegoLienzo } from "@/juego/JuegoLienzo";
import { PantallaInicio } from "@/juego/PantallaInicio";
import { elegirMapaDistinto, SEMILLA_SISTEMA_POR_DEFECTO } from "@/juego/mundos/mapas";
import { suscribirOtraPartida } from "@/juego/control/parteDeGuerraStore";

type Fase = "inicio" | "jugando";

interface Partida {
  readonly clave: number;
  // Mutuamente excluyentes: mapaId presente = modo de suelo plano de
  // siempre (el atajo ?mapa= de los tests e2e de bloques anteriores),
  // ausente = modo espacial (render-espacio), con semillaSistema.
  readonly mapaId?: string;
  readonly semillaSistema?: number;
  readonly personalidadId: string;
}

// Rango del generador con semilla del propio juego (crearGeneradorAleatorio
// trata la semilla como Uint32): de sobra para que "otra partida" en modo
// espacial no repita sistema en la práctica.
const TECHO_SEMILLA_SISTEMA = 2 ** 31;

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
// Sin ?mapa=, el hito jugable de render-espacio: el sistema planetario con
// la semilla fija, no el mapa de suelo plano de siempre. ?mapa=<id> sigue
// siendo el atajo determinista que ya usaban los tests e2e de bloques
// anteriores (render-6, control-1...) que necesitan un mapa concreto.
// ?semilla=<n> es el mismo atajo pero para el modo espacial: esp-1 necesita
// un sistema concreto (con planetas en la posición justa para que un
// disparo curve más de 40px sin salirse del presupuesto de vuelo) y la
// semilla fija de producción no lo garantiza para cualquier ángulo.
function datosInicioIniciales(): Pick<Partida, "mapaId" | "semillaSistema"> {
  if (typeof window === "undefined") return { semillaSistema: SEMILLA_SISTEMA_POR_DEFECTO };
  const parametros = new URLSearchParams(window.location.search);
  const idMapa = parametros.get("mapa");
  if (idMapa) return { mapaId: idMapa };
  const semilla = parametros.get("semilla");
  return { semillaSistema: semilla ? Number(semilla) : SEMILLA_SISTEMA_POR_DEFECTO };
}

export function Aplicacion() {
  const [fase, setFase] = useState<Fase>("inicio");
  const [partida, setPartida] = useState<Partida>(() => ({
    clave: 0,
    ...datosInicioIniciales(),
    personalidadId: "la-contable",
  }));

  useEffect(() => {
    return suscribirOtraPartida(() => {
      setFase("jugando");
      setPartida((actual) => ({
        clave: actual.clave + 1,
        // "Otra partida" respeta el modo de la partida anterior: si venía
        // del atajo ?mapa= (modo de suelo plano), rota a otro de esos tres
        // mapas; si era el hito espacial, sortea un sistema nuevo -- nunca
        // salta de un modo al otro a mitad de sesión.
        ...(actual.mapaId
          ? { mapaId: elegirMapaDistinto(actual.mapaId).id }
          : { semillaSistema: Math.floor(Math.random() * TECHO_SEMILLA_SISTEMA) }),
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
      datosEscena={{
        mapaId: partida.mapaId,
        semillaSistema: partida.semillaSistema,
        personalidadId: partida.personalidadId,
      }}
    />
  );
}
