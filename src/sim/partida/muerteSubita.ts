import type { EventoSimulacion } from "@/sim/partida/eventos";
import type { EstadoNave, EstadoPartida, IdNave } from "@/sim/partida/tipos";

// Desde esta ronda todas las naves vivas pierden vida a la vez al empezar cada
// ronda: es lo que acota por construcción las partidas que ningún bando
// resuelve (hallazgo de las partidas solo de IAs que no terminaban).
export const RONDA_MUERTE_SUBITA = 10;
export const DRENAJE_BASE = 5;

// 5, 10, 15, 20... Crece sin tope: con integridad máxima 100 acumula 105 al
// empezar la ronda RONDA_MUERTE_SUBITA + 5, así que nadie sobrevive más allá.
export function drenajeDeRonda(ronda: number): number {
  return ronda < RONDA_MUERTE_SUBITA ? 0 : DRENAJE_BASE * (ronda - RONDA_MUERTE_SUBITA + 1);
}

// Opt-in como el universo: las simulaciones masivas que miden armas y precios
// no deben ver un drenaje que cambiaría sus resultados.
export function conMuerteSubita(estado: EstadoPartida, ronda = 1): EstadoPartida {
  return { ...estado, ronda, ...(ronda >= RONDA_MUERTE_SUBITA ? { muerteSubita: true } : {}) };
}

// Una ronda nueva empieza cuando el turno vuelve a un asiento anterior o igual
// en el orden fijo: contar por vueltas del orden (y no por turnos entre vivas)
// mantiene la ronda estable aunque alguien caiga a mitad de ella.
export function empiezaRonda(estado: EstadoPartida, tirador: IdNave, siguiente: IdNave): boolean {
  return estado.ordenTurno.indexOf(siguiente) <= estado.ordenTurno.indexOf(tirador);
}

export interface FaseDeRonda {
  readonly ronda: number;
  readonly naves: EstadoNave[];
  readonly eventos: EventoSimulacion[];
}

// El drenaje ignora el escudo: es un daño del universo, no un disparo ajeno.
export function avanzarRonda(estado: EstadoPartida, naves: readonly EstadoNave[]): FaseDeRonda {
  const ronda = (estado.ronda ?? 1) + 1;
  const danio = drenajeDeRonda(ronda);
  const eventos: EventoSimulacion[] = [];
  if (ronda === RONDA_MUERTE_SUBITA - 1) eventos.push({ tipo: "muerte-subita", fase: "aviso", ronda, danio: 0 });
  if (danio === 0) return { ronda, naves: [...naves], eventos };
  eventos.push({ tipo: "muerte-subita", fase: "drenaje", ronda, danio });
  return {
    ronda,
    naves: naves.map((nave) => (nave.integridad > 0 ? { ...nave, integridad: Math.max(0, nave.integridad - danio) } : nave)),
    eventos,
  };
}
