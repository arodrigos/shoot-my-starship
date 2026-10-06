import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { avanzar } from "@/sim/partida/avanzar";
import type { Detonacion } from "@/sim/partida/detonaciones";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import type { EstadoNave, EstadoPartida, FuenteDeTurno, IdNave, ParametrosMundo } from "@/sim/partida/tipos";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { Mascara } from "@/sim/terreno/mascara";

// `planetas` es opcional y el último parámetro a propósito (nucleo-gravedad):
// todo llamante anterior a este bloque sigue compilando y produciendo
// exactamente la misma partida de siempre sin tocarse.
// nucleo-n-naves: `xNaves` sustituye a xNave0/xNave1 -- de 2 a 4 posiciones
// iniciales, una por nave, en el mismo orden en que se les asigna su id y
// su turno. Con dos elementos produce exactamente la partida de siempre.
export function crearPartidaInicial(
  mundo: ParametrosMundo,
  mascara: Mascara,
  xNaves: readonly number[],
  semillaAleatorio: number,
  planetas?: RegistroPlanetas,
): EstadoPartida {
  if (xNaves.length < 2 || xNaves.length > 4) {
    throw new Error(`crearPartidaInicial: se esperaban de 2 a 4 naves, llegaron ${xNaves.length}`);
  }
  const naves: EstadoNave[] = xNaves.map((x) => ({ x, integridad: 100 }));
  const ordenTurno: IdNave[] = naves.map((_nave, id) => id);
  return {
    version: 1,
    mundo,
    mascara,
    naves,
    ordenTurno,
    turno: 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(semillaAleatorio),
    resultado: { tipo: "en-curso" },
    ...(planetas ? { planetas } : {}),
  };
}

// Une una FuenteDeTurno (que decide QUÉ se dispara, y puede consumir azar
// del propio estado) con avanzar (que resuelve el disparo ya decidido). Es
// el punto donde jugador local, IA y fuentes scriptadas dejan de
// distinguirse: todas son la misma función de estado -> entrada.
// nucleo-n-naves: `fuentes` pasa de tupla de 2 a lista paralela a `naves`.
export function jugarTurno(
  estado: EstadoPartida,
  fuentes: readonly FuenteDeTurno[],
): { estado: EstadoPartida; eventos: EventoSimulacion[]; detonaciones: Detonacion[] } {
  const fuente = fuentes[estado.turno];
  const { entrada, estado: estadoTrasDecidir } = fuente(estado);
  return avanzar(estadoTrasDecidir, entrada);
}

export interface ResultadoPartidaCompleta {
  readonly estado: EstadoPartida;
  readonly eventos: EventoSimulacion[];
  // true si se alcanzó limiteTurnos sin que la partida terminara: la red de
  // seguridad de nucleo-5, nunca un desenlace normal.
  readonly agotada: boolean;
}

// Juega turno a turno hasta que hay ganador o se agota limiteTurnos. No es
// el único consumidor posible de jugarTurno -- la cáscara, cuando exista,
// llamará a jugarTurno una vez por turno real en vez de en bucle -- pero es
// lo que necesitan los tests de simulación masiva (nucleo-5, armas-*, ia-*).
export function jugarPartida(
  estadoInicial: EstadoPartida,
  fuentes: readonly FuenteDeTurno[],
  limiteTurnos: number,
): ResultadoPartidaCompleta {
  let estado = estadoInicial;
  const eventos: EventoSimulacion[] = [];

  while (estado.resultado.tipo === "en-curso") {
    if (estado.numeroTurno >= limiteTurnos) {
      return { estado, eventos, agotada: true };
    }
    const resultado = jugarTurno(estado, fuentes);
    estado = resultado.estado;
    eventos.push(...resultado.eventos);
  }

  return { estado, eventos, agotada: false };
}

// Comprueba que un estado no ha caído en ninguno de los casos que nucleo-5
// nombra como "estado imposible": vida negativa, nave fuera del mapa, o
// turno de alguien cuando la partida ya ha terminado. Se usa desde los
// tests, no desde el motor -- el motor ya está construido para no producir
// estos casos, y esto es la comprobación independiente de que lo consigue.
export function comprobarInvariante(estado: EstadoPartida): string[] {
  const problemas: string[] = [];

  for (const [indice, nave] of estado.naves.entries()) {
    if (nave.integridad < 0 || nave.integridad > 100) {
      problemas.push(`nave ${indice}: integridad fuera de rango (${nave.integridad})`);
    }
    if (nave.x < 0 || nave.x > estado.mundo.ancho) {
      problemas.push(`nave ${indice}: x fuera del mapa (${nave.x})`);
    }
  }

  if (estado.resultado.tipo === "terminada") {
    const { ganador } = estado.resultado;
    // nucleo-n-naves: "último en pie" generalizado -- con ganador (no
    // empate), exactamente esa nave queda viva y todas las demás a 0; con
    // empate (ganador null), ninguna queda viva.
    for (const [indice, nave] of estado.naves.entries()) {
      const deberiaEstarViva = indice === ganador;
      if (deberiaEstarViva && nave.integridad <= 0) {
        problemas.push("la nave ganadora tiene integridad <= 0");
      }
      if (!deberiaEstarViva && nave.integridad > 0) {
        problemas.push(`la partida terminó con la nave ${indice} viva sin ser la ganadora`);
      }
    }
  }

  return problemas;
}
