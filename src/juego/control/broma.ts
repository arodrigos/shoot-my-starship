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
}

let estado: EstadoBromas = { disparo: null, impacto: null, categoriaImpacto: null, clave: 0 };
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

// hum-6: el audio nunca decide si esto se llama -- Partida.ts publica la
// broma siempre, independientemente de si reproducirTono() ha podido sonar
// o no (ver reaccionarABroma).
export function publicarBromaDisparo(texto: string): void {
  fijar({ disparo: texto });
}

export function publicarBromaImpacto(texto: string, categoria: CategoriaBroma): void {
  fijar({ impacto: texto, categoriaImpacto: categoria });
}

export function reiniciarBromas(): void {
  estado = { disparo: null, impacto: null, categoriaImpacto: null, clave: 0 };
  for (const escucha of escuchas) escucha();
}
