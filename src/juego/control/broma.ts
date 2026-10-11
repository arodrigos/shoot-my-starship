// Puente React/Phaser para el bocadillo del locutor de partida: mismo patrón
// singleton pub/sub que reaccion.ts, pero separado de aquel a propósito --
// reaccion.ts es humor-sistemico (eventos raros, una sola voz por partida) y
// esto es el resumen que sale cada pocos turnos (voz-resumenes), que sustituyó
// a la broma por disparo. `disparo` se conserva null para no tocar el HUD.
export interface EstadoBromas {
  readonly disparo: string | null;
  readonly impacto: string | null;
  readonly categoriaImpacto: "resumen" | null;
  readonly clave: number;
  // hud-canales-3: histórico consultable, una entrada por resumen.
  readonly historico: readonly EntradaHistoricoBroma[];
}

export interface EntradaHistoricoBroma {
  readonly numeroTurno: number;
  // Asiento que habla: el histórico pinta su nombre con el color de su nave.
  readonly emisor: number;
  readonly disparo: string | null;
  readonly impacto: string;
  readonly categoriaImpacto: "resumen";
}

let estado: EstadoBromas = { disparo: null, impacto: null, categoriaImpacto: null, clave: 0, historico: [] };
const escuchas = new Set<() => void>();

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

// voz-resumenes: sustituye a las bromas por disparo. El texto va en `impacto`
// (el bocadillo y el histórico ya lo pintan) con categoría "resumen".
export function publicarResumen(numeroTurno: number, texto: string, emisor: number): void {
  const entrada: EntradaHistoricoBroma = { numeroTurno, emisor, disparo: null, impacto: texto, categoriaImpacto: "resumen" };
  fijar({ disparo: null, impacto: texto, categoriaImpacto: "resumen", historico: [...estado.historico, entrada] });
}

export function reiniciarBromas(): void {
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
