import { createHash } from "node:crypto";
import { crearEstadoAleatorio, siguienteAleatorio } from "@/sim/aleatorio";
import { comprobarInvariante, crearPartidaInicial, jugarPartida } from "@/sim/partida/motor";
import type { EstadoPartida, FuenteDeTurno, ParametrosMundo } from "@/sim/partida/tipos";

export const MUNDO_LOTE: ParametrosMundo = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: 0, etiquetaDeriva: "lote" };
export const LIMITE_TURNOS_LOTE = 400;

// Fuente que consume el generador que vive en el propio estado de la
// partida (nunca Math.random): usarla en el lote es lo que hace que
// nucleo-4 y nucleo-5 comprueben algo real, no una secuencia fija.
export const fuenteAleatoria: FuenteDeTurno = (estado) => {
  const pasoAngulo = siguienteAleatorio(estado.aleatorio);
  const pasoPotencia = siguienteAleatorio(pasoAngulo.estado);
  return {
    entrada: {
      arma: "referencia",
      anguloGrados: 20 + pasoAngulo.valor * 140,
      potencia: 30 + pasoPotencia.valor * 70,
    },
    estado: { ...estado, aleatorio: pasoPotencia.estado },
  };
};

export interface ResultadoPartidaLote {
  readonly semilla: number;
  readonly ganador: number | null;
  readonly numeroTurno: number;
  readonly agotada: boolean;
  readonly problemas: readonly string[];
}

function jugarUnaPartidaDelLote(semilla: number): ResultadoPartidaLote {
  const inicial: EstadoPartida = crearPartidaInicial(MUNDO_LOTE, 300, 1620, semilla);
  const { estado, agotada } = jugarPartida(inicial, [fuenteAleatoria, fuenteAleatoria], LIMITE_TURNOS_LOTE);
  return {
    semilla,
    ganador: estado.resultado.tipo === "terminada" ? estado.resultado.ganador : null,
    numeroTurno: estado.numeroTurno,
    agotada,
    problemas: comprobarInvariante(estado),
  };
}

// "500 partidas con la misma semilla inicial" solo tiene un significado
// preciso si esa semilla fija el lote entero: aquí se deriva una semilla de
// partida por cada una a partir de una única semilla maestra, así que
// jugarLote(semilla, n) es en sí mismo determinista de punta a punta.
export function semillasDelLote(semillaMaestra: number, n: number): number[] {
  const semillas: number[] = [];
  let estadoAleatorio = crearEstadoAleatorio(semillaMaestra);
  for (let i = 0; i < n; i++) {
    const paso = siguienteAleatorio(estadoAleatorio);
    estadoAleatorio = paso.estado;
    semillas.push(Math.floor(paso.valor * 0xffffffff));
  }
  return semillas;
}

export function jugarLote(semillaMaestra: number, n: number): ResultadoPartidaLote[] {
  return semillasDelLote(semillaMaestra, n).map((semilla) => jugarUnaPartidaDelLote(semilla));
}

export function hashDeLote(lote: readonly ResultadoPartidaLote[]): string {
  return createHash("sha256").update(JSON.stringify(lote)).digest("hex");
}
