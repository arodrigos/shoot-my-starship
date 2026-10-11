import { INTEGRIDAD_MAXIMA } from "@/sim/naves/vida";
// Equipo: acciones que compiten con el disparo por el turno. Viven aparte del
// catálogo de armas porque no tienen efecto de daño, huella ni vuelo propio y
// mezclarlas obligaría a cada consumidor de Arma a descartarlas.
export type IdEquipo = "escudo" | "propulsores";

export interface Equipo {
  readonly id: IdEquipo;
  readonly nombre: string;
  readonly coste: number;
  // Una línea para la celda del selector: lo que hace y que gasta el turno.
  readonly ayuda: string;
  readonly verboAccion: string;
}

export const CATALOGO_EQUIPO: readonly Equipo[] = [
  {
    id: "escudo",
    nombre: "Escudo",
    coste: 90,
    ayuda: "Te protege de los disparos de los demás durante 2 turnos tuyos. Gasta el turno.",
    verboAccion: "Activar escudo",
  },
  {
    id: "propulsores",
    nombre: "Propulsores",
    coste: 60,
    ayuda: "Vuela con la gravedad hasta el círculo marcado. Gasta el turno.",
    verboAccion: "Encender propulsores",
  },
];

export function esIdEquipo(id: string): id is IdEquipo {
  return CATALOGO_EQUIPO.some((equipo) => equipo.id === id);
}

export function buscarEquipo(id: IdEquipo): Equipo {
  const equipo = CATALOGO_EQUIPO.find((candidato) => candidato.id === id);
  if (!equipo) throw new Error(`buscarEquipo: equipo desconocido "${id}"`);
  return equipo;
}

export const COSTE_ESCUDO = 90;
// Turnos propios que protege: baja al empezar cada turno del dueño.
export const TURNOS_ESCUDO = 2;
// Condición de la IA para pagar el escudo (esc-3).
export const INTEGRIDAD_MAXIMA_IA_ESCUDO = INTEGRIDAD_MAXIMA / 2;
