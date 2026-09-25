// Paso fijo con acumulador (gafferongames.com/post/fix_your_timestep): la
// física nunca avanza con el delta real de un fotograma, siempre con
// PASO_FIJO_MS exactos. El acumulador guarda el resto de tiempo que no
// llega a completar un paso todavía. Es lo que hace que el mismo disparo
// caiga en el mismo sitio en un móvil a 30 fps que en un portátil a 120 fps
// (criterio nucleo-1), y es la misma pieza que reutilizará la cáscara para
// interpolar el render entre dos pasos de física.
export const PASO_FIJO_MS = 1000 / 60;

export interface EstadoAcumulador {
  readonly resto: number;
}

export function acumuladorInicial(): EstadoAcumulador {
  return { resto: 0 };
}

export interface ResultadoAvanceConAcumulador<T> {
  readonly estado: T;
  readonly acumulador: EstadoAcumulador;
  readonly pasos: number;
}

// Añade deltaMs al resto pendiente y ejecuta paso() una vez por cada
// PASO_FIJO_MS completo que quepa en él, dejando el sobrante para la
// siguiente llamada. deltaMs puede ser irregular (como lo es un
// requestAnimationFrame real); paso() nunca lo ve, por eso la simulación no
// se acopla al framerate.
export function avanzarConAcumulador<T>(
  estado: T,
  acumulador: EstadoAcumulador,
  deltaMs: number,
  paso: (estado: T) => T,
): ResultadoAvanceConAcumulador<T> {
  let resto = acumulador.resto + deltaMs;
  let actual = estado;
  let pasos = 0;

  while (resto >= PASO_FIJO_MS) {
    actual = paso(actual);
    resto -= PASO_FIJO_MS;
    pasos++;
  }

  return { estado: actual, acumulador: { resto }, pasos };
}
