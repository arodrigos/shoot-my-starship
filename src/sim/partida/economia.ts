import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import type { Arma } from "@/sim/armas/tipos";

// Presupuesto por ronda, igual para todas las naves: sin ingreso por daño,
// porque premiar el daño con crédito en una partida de cuatro es una bola de
// nieve para quien ya va ganando. Es el número más probable de tener que
// moverse al equilibrar, por eso vive aislado en su propio fichero.
export const PRESUPUESTO_BASE = 1000;

// Lo no gastado se arrastra a la ronda siguiente hasta un presupuesto base:
// ahorrar es una decisión, no una carrera de diez rondas acumulando.
export const TOPE_ARRASTRE = PRESUPUESTO_BASE;

export interface SeleccionArmas {
  readonly saldo: number;
  readonly armas: readonly string[];
}

export type ResultadoSeleccion =
  | { readonly ok: true; readonly seleccion: SeleccionArmas }
  | { readonly ok: false; readonly motivo: "saldo-insuficiente"; readonly faltan: number }
  | { readonly ok: false; readonly motivo: "ya-elegida" };

export function costeArma(arma: Arma): number {
  return arma.coste ?? 0;
}

export function puedeCostearArma(arma: Arma, saldo: number): boolean {
  return costeArma(arma) <= saldo;
}

export function seleccionInicial(saldo: number = PRESUPUESTO_BASE): SeleccionArmas {
  return { saldo, armas: [] };
}

// Cada arma elegida es una munición: el saldo baja al elegir (no al
// disparar), así que nunca puede quedar negativo.
export function elegirArma(seleccion: SeleccionArmas, arma: Arma): ResultadoSeleccion {
  if (seleccion.armas.includes(arma.id)) return { ok: false, motivo: "ya-elegida" };
  const coste = costeArma(arma);
  if (coste > seleccion.saldo) return { ok: false, motivo: "saldo-insuficiente", faltan: coste - seleccion.saldo };
  return { ok: true, seleccion: { saldo: seleccion.saldo - coste, armas: [...seleccion.armas, arma.id] } };
}

export function quitarArma(seleccion: SeleccionArmas, arma: Arma): SeleccionArmas {
  if (!seleccion.armas.includes(arma.id)) return seleccion;
  return { saldo: seleccion.saldo + costeArma(arma), armas: seleccion.armas.filter((id) => id !== arma.id) };
}

export function armasGratis(catalogo: readonly Arma[] = CATALOGO_ARMAS): readonly Arma[] {
  return catalogo.filter((arma) => costeArma(arma) === 0);
}

// Con el loadout agotado (o sin haber elegido nada) solo quedan las gratis,
// que no se consumen: es el fondo de armario que impide un callejón sin salida.
export function idsDisponibles(loadout: readonly string[], catalogo: readonly Arma[] = CATALOGO_ARMAS): readonly string[] {
  return loadout.length > 0 ? loadout : armasGratis(catalogo).map((arma) => arma.id);
}

export function consumirArma(loadout: readonly string[], armaId: string): readonly string[] {
  return loadout.filter((id) => id !== armaId);
}

export function saldoDeRonda(saldoNoGastado: number): number {
  return PRESUPUESTO_BASE + Math.min(Math.max(0, saldoNoGastado), TOPE_ARRASTRE);
}
