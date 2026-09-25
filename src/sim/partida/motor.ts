import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { avanzar } from "@/sim/partida/avanzar";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import type { EstadoNave, EstadoPartida, FuenteDeTurno, ParametrosMundo } from "@/sim/partida/tipos";

export function crearPartidaInicial(
  mundo: ParametrosMundo,
  xNave0: number,
  xNave1: number,
  semillaAleatorio: number,
): EstadoPartida {
  const naves: [EstadoNave, EstadoNave] = [
    { x: xNave0, integridad: 100 },
    { x: xNave1, integridad: 100 },
  ];
  return {
    version: 1,
    mundo,
    naves,
    turno: 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(semillaAleatorio),
    resultado: { tipo: "en-curso" },
  };
}

// Une una FuenteDeTurno (que decide QUÉ se dispara, y puede consumir azar
// del propio estado) con avanzar (que resuelve el disparo ya decidido). Es
// el punto donde jugador local, IA y fuentes scriptadas dejan de
// distinguirse: todas son la misma función de estado -> entrada.
export function jugarTurno(
  estado: EstadoPartida,
  fuentes: readonly [FuenteDeTurno, FuenteDeTurno],
): { estado: EstadoPartida; eventos: EventoSimulacion[] } {
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
  fuentes: readonly [FuenteDeTurno, FuenteDeTurno],
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
    const ganador = estado.naves[estado.resultado.ganador];
    const perdedor = estado.naves[estado.resultado.ganador === 0 ? 1 : 0];
    if (ganador.integridad <= 0) {
      problemas.push("la nave ganadora tiene integridad <= 0");
    }
    if (perdedor.integridad > 0) {
      problemas.push("la partida terminó sin que la nave perdedora llegara a 0 de integridad");
    }
  }

  return problemas;
}
