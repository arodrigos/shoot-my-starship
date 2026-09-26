import { PASO_FIJO_MS } from "@/sim/tiempo";
import { GRAVEDAD_REFERENCIA_PX_S2, integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";

// Cota defensiva, no una regla de diseño: a la gravedad y velocidades de
// este juego ningún vuelo real necesita más pasos que esto para aterrizar.
// Si se alcanza, es un condicion "detenerse" mal construida (p.ej. que
// nunca se cumple), y es mejor fallar alto y explicado que colgar la
// partida -- exactamente lo que nucleo-5 vigila desde fuera. Solo aplica al
// modo de un único mapa (sin planetas): ese modo no tiene pozos de gravedad
// donde un proyectil pueda quedarse en órbita, así que "nunca se detiene" ahí
// sigue siendo un error de verdad, no una jugada.
const PASOS_MAXIMOS_VUELO = 100_000;

// 12 s de tiempo simulado (~720 pasos a 60 Hz): con varios pozos de
// gravedad, un proyectil puede entrar en órbita y no cumplir `detenerse`
// nunca -- eso deja de ser un error de programación y pasa a ser un
// resultado de juego legítimo, "proyectil perdido" (grav-6), así que
// necesita su propio presupuesto, más corto que PASOS_MAXIMOS_VUELO.
export const PRESUPUESTO_VUELO_MULTIPOZO_PASOS = Math.round(12_000 / PASO_FIJO_MS);

export interface ResultadoVuelo {
  readonly proyectil: EstadoProyectil;
  readonly pasos: number;
  // true solo cuando, en modo multipozo, se agota el presupuesto de vuelo
  // sin que `detenerse` se cumpliera nunca: un proyectil en órbita estable
  // (grav-6). En el modo de un único mapa (sin planetas) es siempre false.
  readonly perdido: boolean;
}

export interface OpcionesVueloGravitatorio {
  // Su presencia activa el modo multipozo: la aceleración se recalcula en
  // cada paso a partir de la posición actual del proyectil (nucleo-gravedad),
  // en vez de integrar `gravedad`/`deriva` como constantes de vuelo entero.
  // Ambos siguen sumándose encima, como aceleración ambiente uniforme (p.ej.
  // deriva de fondo), nunca se descartan.
  readonly planetas?: RegistroPlanetas;
  readonly presupuestoPasos?: number;
}

// Resuelve un vuelo completo en pasos fijos, sin necesitar tiempo real: es
// lo que permite que avanzar(estado, entradaDeTurno) sea una función pura
// que un test de Node puede llamar sin simular fotogramas. `detenerse` es
// el único punto de extensión: aquí (bloque nucleo-turnos) es un suelo
// plano de referencia porque el terreno real todavía no existe en este
// bloque; balistica-armas la sustituye por la consulta a la máscara sin
// tocar esta función.
//
// `opciones.planetas` (nucleo-gravedad) es aditivo y hacia atrás compatible:
// sin él, el comportamiento es exactamente el de siempre (incluida la
// excepción de "posible vuelo infinito"), y es el camino que siguen todos
// los llamantes de hoy sin tocarse. Con planetas, integrarPasoProyectil NO
// se modifica -- se REUTILIZA tal cual, paso a paso, con la aceleración de
// N cuerpos recién calculada disfrazada de `gravedad`/`deriva` de ese paso
// (deshaciendo el factor GRAVEDAD_REFERENCIA_PX_S2 que la función espera):
// es la forma de que el integrador simpléctico que ya existía siga siendo,
// literalmente, el mismo código.
export function simularVuelo(
  inicial: EstadoProyectil,
  gravedad: number,
  deriva: number,
  detenerse: (proyectil: EstadoProyectil) => boolean,
  opciones?: OpcionesVueloGravitatorio,
): ResultadoVuelo {
  const pasoS = PASO_FIJO_MS / 1000;
  const planetas = opciones?.planetas;
  let proyectil = inicial;
  let pasos = 0;

  if (!planetas || planetas.length === 0) {
    while (!detenerse(proyectil)) {
      if (pasos >= PASOS_MAXIMOS_VUELO) {
        throw new Error("simularVuelo: la condición de parada nunca se cumple (posible vuelo infinito)");
      }
      proyectil = integrarPasoProyectil(proyectil, gravedad, deriva, pasoS);
      pasos++;
    }
    return { proyectil, pasos, perdido: false };
  }

  const presupuesto = opciones?.presupuestoPasos ?? PRESUPUESTO_VUELO_MULTIPOZO_PASOS;
  while (!detenerse(proyectil)) {
    if (pasos >= presupuesto) {
      return { proyectil, pasos, perdido: true };
    }
    const aceleracion = calcularAceleracionGravitatoria(planetas, proyectil.x, proyectil.y);
    proyectil = integrarPasoProyectil(
      proyectil,
      gravedad + aceleracion.y / GRAVEDAD_REFERENCIA_PX_S2,
      deriva + aceleracion.x,
      pasoS,
    );
    pasos++;
  }
  return { proyectil, pasos, perdido: false };
}
