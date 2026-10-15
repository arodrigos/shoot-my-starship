import type { EntradaDeTurno } from "@/sim/partida/tipos";

// reloj-turno: regla fija al agotarse el tiempo. Se elige aquí, como función
// pura, para poder probar con cualquier combinación de arma, saldo y equipo
// que nunca sale una entrada que avanzar() rechace.
export interface SituacionDeMira {
  readonly armaId: string;
  readonly equipoId: string | null;
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly armaGratuitaId: string;
}

export function elegirEntradaDisparoAutomatico(
  mira: SituacionDeMira,
  armaDisparable: (armaId: string) => boolean,
): Pick<EntradaDeTurno, "arma" | "anguloGrados" | "potencia"> {
  // Escudo o propulsores no son un disparo: el reloj nunca los ejecuta.
  const arma = mira.equipoId === null && armaDisparable(mira.armaId) ? mira.armaId : mira.armaGratuitaId;
  return { arma, anguloGrados: mira.anguloGrados, potencia: mira.potencia };
}
