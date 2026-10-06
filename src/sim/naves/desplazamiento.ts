import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";
import { esPosicionValida, type PuntoNave } from "@/sim/naves/zonaValida";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

// Tope duro de candidatos por recolocación: el móvil lo ejecuta en el hilo
// principal al cerrar el turno, así que el coste está acotado por construcción.
export const MAX_CANDIDATOS_DESPLAZAMIENTO = 64;
// Los últimos candidatos se reservan para la salida de emergencia (distancias
// por debajo de d_min); el resto busca el destino normal.
const CANDIDATOS_RESERVA = 16;
const RESPIRO_FUERA_DEL_AREA_U = 8;

// «ninguna» = destino normal en [d_min, OCTAVO]; «mas-lejano» = ningún destino
// normal valía y se usó el más lejano válido más cerca que d_min; «se-queda» =
// tampoco había ninguno y la nave no se mueve.
export type ReservaDesplazamiento = "ninguna" | "mas-lejano" | "se-queda";

export interface ResultadoDesplazamiento {
  readonly x: number;
  readonly y: number;
  readonly reserva: ReservaDesplazamiento;
  readonly aleatorio: EstadoAleatorio;
}

// Un octavo de la diagonal del mundo: el radio que pidió Adrián para que
// repetir el mismo disparo ya no acierte.
export function octavoDelMundo(mundo: ParametrosMundo): number {
  return Math.hypot(mundo.ancho, mundo.alto) / 8;
}

// d_min deja la nave fuera del área del arma que acaba de golpearla; si el
// área es mayor que el octavo, el máximo posible es el propio octavo.
export function distanciaMinimaDesplazamiento(mundo: ParametrosMundo, radioEfectoU: number): number {
  return Math.min(octavoDelMundo(mundo), RADIO_CASCO_NAVE_PX + radioEfectoU + RESPIRO_FUERA_DEL_AREA_U);
}

export interface ParametrosDesplazamiento {
  readonly desde: PuntoNave;
  readonly mundo: ParametrosMundo;
  readonly mascara: Mascara;
  readonly otras: readonly PuntoNave[];
  readonly radioEfectoU: number;
  readonly aleatorio: EstadoAleatorio;
  // Rechaza un destino por una razón que la geometría no ve (p. ej. que el
  // mismo disparo, repetido, volviera a darle ahí). Va aparte de
  // esPosicionValida porque necesita el simulador de vuelo, que no es suyo.
  readonly descartar?: (punto: PuntoNave) => boolean;
}

export function recolocarTrasImpacto(parametros: ParametrosDesplazamiento): ResultadoDesplazamiento {
  const { desde, mundo, mascara, otras, radioEfectoU, descartar } = parametros;
  const octavo = octavoDelMundo(mundo);
  const minima = distanciaMinimaDesplazamiento(mundo, radioEfectoU);
  let aleatorio = parametros.aleatorio;
  let masLejano: { punto: PuntoNave; distancia: number } | null = null;

  for (let candidato = 0; candidato < MAX_CANDIDATOS_DESPLAZAMIENTO; candidato++) {
    const enReserva = candidato >= MAX_CANDIDATOS_DESPLAZAMIENTO - CANDIDATOS_RESERVA;
    const pasoAngulo = siguienteAleatorio(aleatorio);
    const pasoDistancia = siguienteAleatorio(pasoAngulo.estado);
    aleatorio = pasoDistancia.estado;

    const angulo = pasoAngulo.valor * 2 * Math.PI;
    const distancia = enReserva
      ? pasoDistancia.valor * minima
      : minima + pasoDistancia.valor * (octavo - minima);
    const punto = { x: desde.x + Math.cos(angulo) * distancia, y: desde.y + Math.sin(angulo) * distancia };
    if (!esPosicionValida(punto, mundo, mascara, otras)) continue;
    if (descartar?.(punto)) continue;

    if (!enReserva) return { ...punto, reserva: "ninguna", aleatorio };
    if (masLejano === null || distancia > masLejano.distancia) masLejano = { punto, distancia };
  }

  if (masLejano !== null) return { ...masLejano.punto, reserva: "mas-lejano", aleatorio };
  return { x: desde.x, y: desde.y, reserva: "se-queda", aleatorio };
}
