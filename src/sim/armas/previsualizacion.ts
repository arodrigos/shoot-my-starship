import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { ALTURA_CANON_PX, alturaSuperficie, crearDetenerseConMecha, detenerseEnSuelo } from "@/sim/armas/resolver";
import { pasosDeMecha } from "@/sim/fisica/comportamientoExtendido";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { Mascara } from "@/sim/terreno/mascara";
import type { ComportamientoDeVuelo } from "@/sim/armas/tipos";
import type { RastreadorImpactoNaves } from "@/sim/naves/impacto";
import type { EstadoAleatorio } from "@/sim/aleatorio";

// prevision-real: cuántos pasos de simularVuelo se muestran como previsualización.
// 90 pasos (1,5s a PASO_FIJO_MS=1000/60) es suficiente para leer la curvatura de
// los pozos cercanos sin que la mira llegue casi nunca al punto de impacto real
// (pvr-2 corta igualmente la cola si lo alcanzara). "erratico" (la mosca) solo
// sigue la parábola marcada en los primeros pasos, antes de que la restitución
// Ornstein-Uhlenbeck de la perturbación acumule desplazamiento apreciable --
// pasado ese tramo, enseñar la parábola sería mentir sobre lo que la mosca
// realmente hace, así que se corta mucho antes.
export const PASOS_PREVISUALIZACION = 90;
export const PASOS_PREVISUALIZACION_ERRATICO = 8;

// pvr-2: nunca se revela el punto de impacto. Si el vuelo real (detenerseEnSuelo)
// termina dentro de la ventana de previsualización, se recorta la cola hasta que
// el último punto quede a más de esta distancia del punto de contacto resuelto.
export const DISTANCIA_MINIMA_OCULTA_IMPACTO_PX = 40;

export interface ParametrosPrevisualizacion {
  readonly mascara: Mascara;
  readonly gravedad: number;
  readonly deriva: number;
  readonly ancho: number;
  readonly alto: number;
  readonly planetas?: RegistroPlanetas;
  readonly rastreadorNaves?: RastreadorImpactoNaves;
  readonly origenX: number;
  readonly origenY?: number;
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly comportamiento: ComportamientoDeVuelo;
  // mos-1: el mismo EstadoAleatorio hilvanado que consumiría el disparo real
  // si se hiciera ahora -- NUNCA una semilla propia de la previsualización.
  // Es de solo lectura: el resultado de simularVuelo aquí se descarta, nunca
  // se hilvana de vuelta al estado de partida. Sin ella, "erratico" se
  // muestra sin perturbación (ballística pura), que sigue siendo honesto
  // para el tramo cortísimo que se enseña (pvr-2).
  readonly aleatorio?: EstadoAleatorio;
}

export interface PuntoPrevisualizacion {
  readonly x: number;
  readonly y: number;
}

// pvr-1: calcula la previsualización llamando al MISMO simularVuelo que
// resuelve un disparo real (nunca una fórmula de gravedad uniforme aparte),
// con el campo multipozo completo cuando lo hay -- es, literalmente, un
// prefijo de los primeros pasos del vuelo real, no una aproximación.
//
// `simularVuelo` solo respeta `presupuestoPasos` en modo multipozo (nucleo-
// gravedad): en el modo de un único mapa corre hasta `detenerse` sin más
// cota que PASOS_MAXIMOS_VUELO. Por eso el corte de pasos de la previsualización
// se hace envolviendo `detenerse` -- el único punto de extensión que el propio
// vuelo.ts documenta -- en vez de depender de esa opción, y así el límite es
// el mismo en los dos modos sin tocar simularVuelo.
export function calcularPrevisualizacion(params: ParametrosPrevisualizacion): readonly PuntoPrevisualizacion[] {
  const esInstantaneo = params.comportamiento.tipo === "instantaneo";
  const esErratico = params.comportamiento.tipo === "erratico";

  const origenY = params.origenY ?? alturaSuperficie(params.mascara, params.origenX) ?? params.alto - 1;
  const rad = (params.anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(params.potencia);
  const inicial = crearProyectil(params.origenX, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));

  // arm-4/arm-6: el láser instantáneo vuela con gravedad 0 y sin planetas --
  // el mismo ajuste que hace resolver.ts para el disparo real.
  const detenerseSuelo = detenerseEnSuelo(params.mascara, params.ancho, params.alto);
  let detenerseReal = esInstantaneo ? (p: EstadoProyectil) => p.y < 0 || detenerseSuelo(p) : detenerseSuelo;
  const gravedad = esInstantaneo ? 0 : params.gravedad;
  const deriva = esInstantaneo ? 0 : params.deriva;
  const planetas = esInstantaneo ? undefined : params.planetas;
  const rastreadorNaves = esInstantaneo ? undefined : params.rastreadorNaves;

  // vex-1/vex-4: la granada/mina con mecha también puede detonar en el aire,
  // por temporizador -- un airburst dentro de la ventana de previsualización
  // es un contacto real tanto como el terreno, y hay que poder ocultarlo
  // igual (pvr-2 no distingue "cómo" detona, solo "que no se adivine dónde").
  if (params.comportamiento.tipo === "mecha" || params.comportamiento.tipo === "adherente-con-mecha") {
    detenerseReal = crearDetenerseConMecha(detenerseReal, pasosDeMecha(params.comportamiento.segundosHastaDetonar));
  }

  const perturbacion =
    params.comportamiento.tipo === "erratico" && params.aleatorio
      ? { magnitudPxS2: params.comportamiento.magnitudPxS2, aleatorio: params.aleatorio }
      : undefined;

  const pasosDeclarados = esErratico ? PASOS_PREVISUALIZACION_ERRATICO : PASOS_PREVISUALIZACION;

  let llamadas = 0;
  let cortadoPorPresupuesto = false;
  const detenerseAcotado = (p: EstadoProyectil): boolean => {
    if (detenerseReal(p)) return true;
    llamadas++;
    if (llamadas > pasosDeclarados) {
      cortadoPorPresupuesto = true;
      return true;
    }
    return false;
  };

  const resultado = simularVuelo(inicial, gravedad, deriva, detenerseAcotado, {
    planetas,
    rastreadorNaves,
    perturbacion,
    grabarTrayectoria: true,
  });

  const trayectoria = resultado.trayectoria ?? [inicial];

  // Si el corte lo impuso el presupuesto de previsualización, el vuelo real
  // sigue más allá de lo mostrado -- ningún punto de la lista es un contacto
  // real (terreno o nave), así que no hay nada que ocultar.
  if (cortadoPorPresupuesto) return trayectoria;

  const contacto = trayectoria[trayectoria.length - 1];
  let corte = trayectoria.length;
  while (
    corte > 1 &&
    Math.hypot(trayectoria[corte - 1].x - contacto.x, trayectoria[corte - 1].y - contacto.y) < DISTANCIA_MINIMA_OCULTA_IMPACTO_PX
  ) {
    corte--;
  }
  return trayectoria.slice(0, corte);
}
