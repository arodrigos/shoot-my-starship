// Generador pseudoaleatorio determinista (mulberry32): la única fuente de
// azar que puede existir en src/sim. El azar del navegador no aparece aquí
// -- es lo que garantiza que la misma semilla produzca siempre la misma
// máscara de terreno (criterio terreno-1) y, más adelante, la misma partida
// completa (criterio nucleo-4).
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

// Versión pura del mismo mulberry32, para cuando el azar tiene que vivir
// DENTRO de un estado serializable (criterio nucleo-2: JSON.stringify y
// reanudar en otro proceso) en vez de en la variable cerrada de una closure,
// que no sobrevive a serializar. crearGeneradorAleatorio sigue existiendo
// para la generación de un solo uso (el terreno, que no se reanuda a medio
// generar); esta es para el estado de partida, que sí.
export interface EstadoAleatorio {
  readonly semilla: number;
}

export function crearEstadoAleatorio(semilla: number): EstadoAleatorio {
  return { semilla: semilla >>> 0 };
}

export interface PasoAleatorio {
  readonly valor: number;
  readonly estado: EstadoAleatorio;
}

export function siguienteAleatorio(estado: EstadoAleatorio): PasoAleatorio {
  const s = (estado.semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const valor = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { valor, estado: { semilla: s } };
}
