import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { eventosDisponibles } from "@/sim/universo/catalogoEventos";
import type { FasePartida, EventoProgramado } from "@/sim/universo/tipos";
import type { IdNave, ModoJuego } from "@/sim/partida/tipos";

export const INTERVALO_MINIMO_TURNOS = 2;
export const INTERVALO_MAXIMO_TURNOS = 5;

export interface ContextoSorteo {
  readonly modo: ModoJuego | undefined;
  readonly fase: FasePartida;
  readonly vivas: readonly IdNave[];
}

// Uniforme en [0, cuantos): un único sitio donde se convierte el flotante del
// generador en índice, para que todos los sorteos consuman azar igual.
export function sortearIndice(aleatorio: EstadoAleatorio, cuantos: number): { indice: number; aleatorio: EstadoAleatorio } {
  const paso = siguienteAleatorio(aleatorio);
  return { indice: Math.min(cuantos - 1, Math.floor(paso.valor * cuantos)), aleatorio: paso.estado };
}

// Tipo y afectado salen de los eventos disponibles ahora; el aviso de «dentro de
// N turnos» sale con ellos ya decididos.
export function sortearEvento(
  aleatorio: EstadoAleatorio,
  contexto: ContextoSorteo,
  enTurnos: number,
): { evento: EventoProgramado; aleatorio: EstadoAleatorio } {
  const disponibles = eventosDisponibles(contexto.modo, contexto.fase);
  const tipo = sortearIndice(aleatorio, disponibles.length);
  const afectado = sortearIndice(tipo.aleatorio, contexto.vivas.length);
  return {
    evento: { enTurnos, tipo: disponibles[tipo.indice].tipo, afectado: contexto.vivas[afectado.indice] },
    aleatorio: afectado.aleatorio,
  };
}

// Programa el siguiente evento de calendario a 2-5 turnos de ahora.
export function programarSiguiente(
  aleatorio: EstadoAleatorio,
  contexto: ContextoSorteo,
): { evento: EventoProgramado; aleatorio: EstadoAleatorio } {
  const intervalo = sortearIndice(aleatorio, INTERVALO_MAXIMO_TURNOS - INTERVALO_MINIMO_TURNOS + 1);
  return sortearEvento(intervalo.aleatorio, contexto, INTERVALO_MINIMO_TURNOS + intervalo.indice);
}
