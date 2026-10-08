import type { CategoriaBroma } from "@/sim/partida/categoriaBroma";

// Puente React/Phaser para el panel de bromas de humor-por-turno (hum-1,
// hum-6): mismo patrón singleton pub/sub que reaccion.ts, pero separado de
// aquel a propósito -- reaccion.ts es humor-sistemico (eventos raros, una
// sola voz por partida) y esto es una broma en CADA disparo y CADA impacto,
// sin excepción, con la voz de la nave que la dice. Dos claves ("disparo" e
// "impacto") porque hum-1 exige que aparezcan las dos, no una que sustituya
// a la otra si coinciden en el mismo turno.
export interface EstadoBromas {
  readonly disparo: string | null;
  readonly impacto: string | null;
  readonly categoriaImpacto: CategoriaBroma | null;
  readonly clave: number;
  // hud-canales-3: histórico consultable, uno por turno resuelto (no uno por
  // cada publicarBroma* -- el disparo es opcional por turno, el impacto no,
  // así que ambos se combinan en una sola entrada cuando llega el impacto).
  readonly historico: readonly EntradaHistoricoBroma[];
}

export interface EntradaHistoricoBroma {
  readonly numeroTurno: number;
  // Asiento que habla: el histórico pinta su nombre con el color de su nave.
  readonly emisor: number;
  readonly disparo: string | null;
  readonly impacto: string;
  readonly categoriaImpacto: CategoriaBroma;
}

let estado: EstadoBromas = { disparo: null, impacto: null, categoriaImpacto: null, clave: 0, historico: [] };
const escuchas = new Set<() => void>();

// Disparo publicado a la espera del impacto del mismo turno -- el impacto
// siempre llega (hum-1: "sin excepción"), así que esto nunca se queda
// colgado de un turno al siguiente sin resolverse.
let pendienteDeTurno: { numeroTurno: number; disparo: string } | null = null;

function fijar(parcial: Partial<EstadoBromas>): void {
  estado = { ...estado, ...parcial, clave: estado.clave + 1 };
  for (const escucha of escuchas) escucha();
}

export function obtenerBromas(): EstadoBromas {
  return estado;
}

export function suscribirBromas(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

// hum-6: el audio nunca decide si esto se llama -- Partida.ts publica la
// broma siempre, independientemente de si reproducirTono() ha podido sonar
// o no (ver reaccionarABroma).
export function publicarBromaDisparo(numeroTurno: number, texto: string): void {
  pendienteDeTurno = { numeroTurno, disparo: texto };
  fijar({ disparo: texto });
}

export function publicarBromaImpacto(numeroTurno: number, texto: string, categoria: CategoriaBroma, emisor: number): void {
  const disparo = pendienteDeTurno && pendienteDeTurno.numeroTurno === numeroTurno ? pendienteDeTurno.disparo : null;
  pendienteDeTurno = null;
  const entrada: EntradaHistoricoBroma = { numeroTurno, emisor, disparo, impacto: texto, categoriaImpacto: categoria };
  fijar({ impacto: texto, categoriaImpacto: categoria, historico: [...estado.historico, entrada] });
}

export function reiniciarBromas(): void {
  pendienteDeTurno = null;
  estado = { disparo: null, impacto: null, categoriaImpacto: null, clave: 0, historico: [] };
  for (const escucha of escuchas) escucha();
}

// Solo para el gancho de depuración: los e2e necesitan un histórico largo sin
// jugar decenas de turnos reales. No toca la broma visible ni el audio.
export function inyectarHistorico(entradas: readonly EntradaHistoricoBroma[]): void {
  fijar({ historico: [...entradas] });
}

// Cuenta de mensajes sueltos (disparo e impacto), que es lo que enseña el
// botón «Histórico (N)»: el jugador lee mensajes, no turnos.
export function contarMensajes(historico: readonly EntradaHistoricoBroma[]): number {
  return historico.reduce((total, entrada) => total + (entrada.disparo ? 2 : 1), 0);
}
