// musica-tension: cuánto se ha puesto tensa la partida, para que la música
// gane capas. Es cálculo puro sobre lo que la escena ya publica; no toca
// src/sim ni el audio.

export type NivelTension = 0 | 1 | 2 | 3;

export interface SenalesTension {
  // Aviso de muerte súbita publicado o drenaje ya en marcha.
  readonly muerteSubita: boolean;
  // Integridad de cada nave viva en % de la máxima (0-100).
  readonly integridadesVivas: readonly number[];
  readonly vivas: number;
}

// Una nave "con poca vida" es la que queda en el 25 % o menos; la muerta no
// cuenta, ya no está en juego.
export const UMBRAL_VIDA_BAJA_PCT = 25;

export function nivelTension(senales: SenalesTension): NivelTension {
  const vidaBaja = senales.integridadesVivas.some((pct) => pct > 0 && pct <= UMBRAL_VIDA_BAJA_PCT);
  const nivel = (senales.muerteSubita ? 1 : 0) + (vidaBaja ? 1 : 0) + (senales.vivas === 2 ? 1 : 0);
  return Math.min(3, nivel) as NivelTension;
}

// Cierres de turno seguidos con un nivel menor antes de bajar: un golpe de
// suerte o una curación no deben apagar la percusión a mitad del duelo.
export const CIERRES_PARA_BAJAR = 2;

export interface EstadoHisteresis {
  readonly aplicado: NivelTension;
  readonly cierresMenores: number;
}

export const HISTERESIS_INICIAL: EstadoHisteresis = { aplicado: 0, cierresMenores: 0 };

// Sube de inmediato (el programador lo aplica en la siguiente frontera de
// compás); baja solo tras CIERRES_PARA_BAJAR cierres seguidos con un nivel
// menor, y entonces al más reciente.
export function siguienteHisteresis(estado: EstadoHisteresis, crudo: NivelTension): EstadoHisteresis {
  if (crudo > estado.aplicado) return { aplicado: crudo, cierresMenores: 0 };
  if (crudo === estado.aplicado) return { aplicado: estado.aplicado, cierresMenores: 0 };
  const cierresMenores = estado.cierresMenores + 1;
  return cierresMenores >= CIERRES_PARA_BAJAR ? { aplicado: crudo, cierresMenores: 0 } : { aplicado: estado.aplicado, cierresMenores };
}
