import type { IdNave } from "@/sim/partida/tipos";

// Puente React/Phaser para la barra de integridad por nave (imp-11): mismo
// patrón singleton pub/sub que resultadoTurnoStore.ts. Vive aparte de
// EstadoControl porque la integridad es un dato de la PARTIDA (las dos
// naves), no del ajuste de disparo de quien juega.
export interface IntegridadNave {
  readonly id: IdNave;
  readonly integridad: number;
}

export interface EstadoIntegridad {
  readonly naves: readonly IntegridadNave[];
}

const ESTADO_INICIAL: EstadoIntegridad = {
  naves: [
    { id: 0, integridad: 100 },
    { id: 1, integridad: 100 },
  ],
};

let estado: EstadoIntegridad = ESTADO_INICIAL;
const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoIntegridad>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

export function obtenerIntegridad(): EstadoIntegridad {
  return estado;
}

export function suscribirIntegridad(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarIntegridad(naves: readonly { readonly integridad: number }[]): void {
  fijar({ naves: naves.map((nave, indice) => ({ id: indice as IdNave, integridad: nave.integridad })) });
}

// partida-completa: mismo motivo que reiniciarResultadoTurno -- singleton de
// módulo, hay que devolverlo al estado inicial al arrancar una escena nueva.
export function reiniciarIntegridad(): void {
  fijar(ESTADO_INICIAL);
}
