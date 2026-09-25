import { PASO_FIJO_MS } from "@/sim/tiempo";
import { integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";

// Cota defensiva, no una regla de diseño: a la gravedad y velocidades de
// este juego ningún vuelo real necesita más pasos que esto para aterrizar.
// Si se alcanza, es un condicion "detenerse" mal construida (p.ej. que
// nunca se cumple), y es mejor fallar alto y explicado que colgar la
// partida -- exactamente lo que nucleo-5 vigila desde fuera.
const PASOS_MAXIMOS_VUELO = 100_000;

export interface ResultadoVuelo {
  readonly proyectil: EstadoProyectil;
  readonly pasos: number;
}

// Resuelve un vuelo completo en pasos fijos, sin necesitar tiempo real: es
// lo que permite que avanzar(estado, entradaDeTurno) sea una función pura
// que un test de Node puede llamar sin simular fotogramas. `detenerse` es
// el único punto de extensión: aquí (bloque nucleo-turnos) es un suelo
// plano de referencia porque el terreno real todavía no existe en este
// bloque; balistica-armas la sustituye por la consulta a la máscara sin
// tocar esta función.
export function simularVuelo(
  inicial: EstadoProyectil,
  gravedad: number,
  deriva: number,
  detenerse: (proyectil: EstadoProyectil) => boolean,
): ResultadoVuelo {
  const pasoS = PASO_FIJO_MS / 1000;
  let proyectil = inicial;
  let pasos = 0;

  while (!detenerse(proyectil)) {
    if (pasos >= PASOS_MAXIMOS_VUELO) {
      throw new Error("simularVuelo: la condición de parada nunca se cumple (posible vuelo infinito)");
    }
    proyectil = integrarPasoProyectil(proyectil, gravedad, deriva, pasoS);
    pasos++;
  }

  return { proyectil, pasos };
}
