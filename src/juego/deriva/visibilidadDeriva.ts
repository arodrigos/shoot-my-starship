// El rótulo «Vacío: aquí no empuja nada…» de las partidas espaciales se queda
// quieto sobre el lienzo y acaba tapando un planeta (#199). Se enseña unos
// segundos para que se lea y después se retira.
export const MS_ROTULO_VISIBLE = 4000;
export const MS_DESVANECIDO_ROTULO = 400;

export interface EntradaAlfaRotuloDeriva {
  readonly modoEspacial: boolean;
  readonly deriva: number;
  // Tiempo de escena acumulado desde que el tablero queda a la vista.
  readonly msVisible: number;
  readonly reducirMovimiento: boolean;
}

// Solo el rótulo de deriva 0 de las partidas espaciales se desvanece: en suelo
// plano (?mapa=) la flecha y su etiqueta informan de una fuerza real y se
// pintan siempre.
export function alfaRotuloDeriva({ modoEspacial, deriva, msVisible, reducirMovimiento }: EntradaAlfaRotuloDeriva): number {
  if (!modoEspacial || deriva !== 0) return 1;
  if (msVisible < MS_ROTULO_VISIBLE) return 1;
  if (reducirMovimiento) return 0;
  const alfa = 1 - (msVisible - MS_ROTULO_VISIBLE) / MS_DESVANECIDO_ROTULO;
  return Math.min(1, Math.max(0, alfa));
}
