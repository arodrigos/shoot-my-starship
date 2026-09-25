// Generador pseudoaleatorio determinista (mulberry32): la única fuente de
// azar que puede existir en src/sim. Nunca se usa Math.random aquí -- es lo
// que garantiza que la misma semilla produzca siempre la misma máscara de
// terreno (criterio terreno-1) y, más adelante, la misma partida completa
// (criterio nucleo-4).
export type GeneradorAleatorio = () => number;

export function crearGeneradorAleatorio(semilla: number): GeneradorAleatorio {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
