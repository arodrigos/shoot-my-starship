import { PASO_FIJO_MS } from "@/sim/tiempo";
import { GRAVEDAD_REFERENCIA_PX_S2, integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { ImpactoNave, RastreadorImpactoNaves } from "@/sim/naves/impacto";

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

// impacto-naves (imp-10): contador de vuelos simulados, solo para que los
// tests de presupuesto de cómputo (la creación de partida nunca debe superar
// 6.000 vuelos) puedan medir el coste real de colocarNaves sin instrumentar
// cada llamante uno a uno -- simularVuelo es el único punto por el que pasa
// CUALQUIER vuelo, incluidas las submuniciones. No lo usa ningún camino de
// producción.
let contadorVuelosSimulados = 0;

export function vuelosSimuladosTotales(): number {
  return contadorVuelosSimulados;
}

export function reiniciarContadorVuelosSimulados(): void {
  contadorVuelosSimulados = 0;
}

export interface ResultadoVuelo {
  readonly proyectil: EstadoProyectil;
  readonly pasos: number;
  // impacto-naves (imp-1): la nave (si alguna) cuyo casco ha cortado el
  // SEGMENTO de este paso, con el punto de corte real -- null en cualquier
  // otro resultado de vuelo (sólido, fuera de mundo, presupuesto agotado, o
  // sin `opciones.rastreadorNaves`). Aditivo: ningún llamante de antes de
  // este bloque pasa un rastreador, así que para ellos este campo es
  // siempre null.
  readonly impactoNave: ImpactoNave | null;
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
  // impacto-naves: opcional y aditivo -- sin él, el comportamiento es
  // exactamente el de siempre (ningún casco detiene nada). Se comprueba en
  // el ORDEN que fija el diseño: primero el casco del segmento de este
  // paso, y solo si no corta ninguno se evalúa `detenerse` (sólido, fuera de
  // mundo). Es lo que hace que el casco "siempre gane" al terreno cuando el
  // mismo paso cruza los dos.
  readonly rastreadorNaves?: RastreadorImpactoNaves;
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
  contadorVuelosSimulados++;
  const pasoS = PASO_FIJO_MS / 1000;
  const planetas = opciones?.planetas;
  const rastreadorNaves = opciones?.rastreadorNaves;
  let proyectil = inicial;
  let pasos = 0;

  if (!planetas || planetas.length === 0) {
    while (!detenerse(proyectil)) {
      if (pasos >= PASOS_MAXIMOS_VUELO) {
        throw new Error("simularVuelo: la condición de parada nunca se cumple (posible vuelo infinito)");
      }
      const siguiente = integrarPasoProyectil(proyectil, gravedad, deriva, pasoS);
      const impactoNave = rastreadorNaves?.comprobarPaso(proyectil, siguiente) ?? null;
      pasos++;
      if (impactoNave) {
        return { proyectil: { ...siguiente, x: impactoNave.x, y: impactoNave.y }, pasos, impactoNave, perdido: false };
      }
      proyectil = siguiente;
    }
    return { proyectil, pasos, impactoNave: null, perdido: false };
  }

  const presupuesto = opciones?.presupuestoPasos ?? PRESUPUESTO_VUELO_MULTIPOZO_PASOS;
  while (!detenerse(proyectil)) {
    if (pasos >= presupuesto) {
      return { proyectil, pasos, impactoNave: null, perdido: true };
    }
    const aceleracion = calcularAceleracionGravitatoria(planetas, proyectil.x, proyectil.y);
    const siguiente = integrarPasoProyectil(
      proyectil,
      gravedad + aceleracion.y / GRAVEDAD_REFERENCIA_PX_S2,
      deriva + aceleracion.x,
      pasoS,
    );
    const impactoNave = rastreadorNaves?.comprobarPaso(proyectil, siguiente) ?? null;
    pasos++;
    if (impactoNave) {
      return { proyectil: { ...siguiente, x: impactoNave.x, y: impactoNave.y }, pasos, impactoNave, perdido: false };
    }
    proyectil = siguiente;
  }
  return { proyectil, pasos, impactoNave: null, perdido: false };
}
