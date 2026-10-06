import { COSTE_ESCUDO, INTEGRIDAD_MAXIMA_IA_ESCUDO } from "@/sim/equipo/catalogo";

export interface SituacionEscudoIA {
  readonly integridad: number;
  // Saldo de la IA en el modo con presupuesto; undefined en barra libre.
  readonly saldo: number | undefined;
  readonly danioRecibidoDesdeSuTurno: boolean;
  readonly escudoActivo: boolean;
}

// Criterio comprensible de la IA para protegerse: solo paga el escudo si le
// llega el saldo, ya va tocada y alguien le acaba de hacer daño. En barra libre
// no lo usa (no hay saldo que gestionar) y en este run tampoco usa propulsores.
export function debeActivarEscudoIA(situacion: SituacionEscudoIA): boolean {
  if (situacion.saldo === undefined || situacion.escudoActivo) return false;
  return situacion.saldo >= COSTE_ESCUDO && situacion.integridad <= INTEGRIDAD_MAXIMA_IA_ESCUDO && situacion.danioRecibidoDesdeSuTurno;
}
