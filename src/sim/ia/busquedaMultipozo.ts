import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { ALTURA_CANON_PX, detenerseEnSuelo } from "@/sim/armas/resolver";
import type { Mascara } from "@/sim/terreno/mascara";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";

// ia-multipozo: el solucionador de fórmula cerrada (balistica/solucionador.ts)
// no tiene solución analítica con más de un pozo de gravedad -- este módulo
// lo sustituye para el rival con una búsqueda por método de tiro, reutilizando
// LITERALMENTE simularVuelo y detenerseEnSuelo (las mismas funciones que
// resolverDisparo usa para un disparo real, sin overridear su presupuesto de
// pasos): es la única forma de que ia-n2 pueda exigir "coinciden posición a
// posición, sin tolerancia" en vez de "se parecen".
const ANGULO_MIN_GRADOS = 2;
const ANGULO_MAX_GRADOS = 178;
const NUM_ANGULOS_REJILLA = 48;
const POTENCIAS_PROBADAS_PORCENTAJE = [30, 44, 58, 72, 86, 100];
const RONDAS_REFINAMIENTO = 3;
const PASO_ANGULO_GRUESO_GRADOS = (ANGULO_MAX_GRADOS - ANGULO_MIN_GRADOS) / (NUM_ANGULOS_REJILLA - 1);

// Sonda de sensibilidad: medio grado a cada lado del mejor candidato, fuera
// del presupuesto de precisión (rejilla + refinamiento) pero contra el mismo
// tope duro de vuelos -- ia-n5 necesita saber cuánto se mueve el impacto por
// grado cerca de la solución, no una precisión mayor de la solución en sí.
const DELTA_SENSIBILIDAD_GRADOS = 0.5;
// Techo de "sensibilidad" cuando una sonda se pierde en órbita: el propio
// hecho de que medio grado de diferencia baste para perder el proyectil ya
// es la señal de máxima sensibilidad posible, no una ausencia de dato.
const SENSIBILIDAD_MAXIMA_PX_GRADO = 500;

// ia-n3: techo de vuelos simulados por turno del rival. La rejilla (288) más
// el refinamiento (hasta 6) más las dos sondas de sensibilidad quedan muy por
// debajo -- el margen es a propósito, para que agotar el presupuesto sea
// siempre "el mundo era raro", nunca "el rival se comió su propio turno".
export const PRESUPUESTO_VUELOS_RIVAL_DEFAULT = 1200;

export interface ParametrosBusquedaRival {
  readonly mascara: Mascara;
  readonly ancho: number;
  readonly alto: number;
  readonly planetas: RegistroPlanetas;
  readonly gravedad: number;
  readonly deriva: number;
  readonly origenX: number;
  readonly origenY: number;
  // El impacto se mide solo en X (ver distanciaImpacto): no hace falta la Y
  // del objetivo aquí.
  readonly objetivoX: number;
  readonly toleranciaPx: number;
  // ia-n3 lo baja a 10 para forzar el agotamiento en el test; por defecto es
  // PRESUPUESTO_VUELOS_RIVAL_DEFAULT.
  readonly presupuestoVuelosMax?: number;
}

export interface SolucionRival {
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly distanciaFinalPx: number;
  // px de movimiento del punto de impacto por grado de ángulo, cerca de la
  // solución -- ia-n5 lo usa para escalar el error de personalidad.
  readonly sensibilidadPxPorGrado: number;
  readonly vuelosSimulados: number;
  // true si se agotó el presupuesto de vuelos ANTES de llegar a tolerancia:
  // lo que se devuelve es el mejor esfuerzo encontrado hasta ese momento,
  // nunca una excepción (ia-n3).
  readonly agotado: boolean;
}

// "Impacta" se mide igual que en todo el resto de la IA (ia-1/ia-2,
// trazado.ts) y que el propio daño de resolver.ts: distancia en X desde
// donde el vuelo se detiene de verdad, nunca la distancia 2D al punto
// (objetivoX, objetivoY). Las naves flotan sin hitbox de colisión propia
// (colocacion.ts) así que el proyectil nunca "choca" contra ellas -- sigue
// hasta tocar algo sólido o salir del mundo, y lo que importa para el daño
// es en qué X termina, no lo cerca que pasó en el camino.
function distanciaImpacto(x: number, objetivoX: number): number {
  return Math.abs(x - objetivoX);
}

interface ResultadoVuelo {
  readonly perdido: boolean;
  readonly x: number;
  readonly y: number;
}

// La unidad mínima que rejilla, refinamiento y sonda de sensibilidad
// reutilizan sin duplicar la llamada -- ni la condición de parada ni el
// presupuesto de pasos difieren nunca de los de un disparo real (ia-n2).
function volarCandidato(
  params: ParametrosBusquedaRival,
  origenCanonY: number,
  anguloGrados: number,
  potencia: number,
): ResultadoVuelo {
  const v = velocidadDesdePotencia(potencia);
  const rad = (anguloGrados * Math.PI) / 180;
  const inicial: EstadoProyectil = crearProyectil(params.origenX, origenCanonY, v * Math.cos(rad), -v * Math.sin(rad));
  const detenerse = detenerseEnSuelo(params.mascara, params.ancho, params.alto);
  const { proyectil, perdido } = simularVuelo(inicial, params.gravedad, params.deriva, detenerse, {
    planetas: params.planetas,
  });
  return { perdido, x: proyectil.x, y: proyectil.y };
}

// Busca el disparo (ángulo x potencia) que más acerca el proyectil al
// objetivo, con presupuesto duro de vuelos simulados: rejilla gruesa (48
// ángulos x 6 potencias) primero, con salida temprana en cuanto algo cae
// dentro de tolerancia; si nada basta, refinamiento ternario local (hasta 3
// rondas) alrededor del mejor candidato, a su misma potencia -- igual que
// balistica/busqueda.ts, pero pensado para jugar cada turno, no para
// comprobar viabilidad una vez al colocar naves.
export function buscarSolucionRival(params: ParametrosBusquedaRival): SolucionRival {
  const presupuestoMax = params.presupuestoVuelosMax ?? PRESUPUESTO_VUELOS_RIVAL_DEFAULT;
  const origenCanonY = params.origenY - ALTURA_CANON_PX;

  let vuelosSimulados = 0;
  let mejorAngulo = ANGULO_MIN_GRADOS;
  let mejorPotencia = POTENCIAS_PROBADAS_PORCENTAJE[0];
  let mejorDistancia = Infinity;

  busquedaGrid: for (const potencia of POTENCIAS_PROBADAS_PORCENTAJE) {
    for (let i = 0; i < NUM_ANGULOS_REJILLA; i++) {
      if (vuelosSimulados >= presupuestoMax) break busquedaGrid;
      const angulo = ANGULO_MIN_GRADOS + i * PASO_ANGULO_GRUESO_GRADOS;
      const resultado = volarCandidato(params, origenCanonY, angulo, potencia);
      vuelosSimulados++;
      const d = resultado.perdido ? Infinity : distanciaImpacto(resultado.x, params.objetivoX);
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejorAngulo = angulo;
        mejorPotencia = potencia;
      }
      if (mejorDistancia <= params.toleranciaPx) break busquedaGrid;
    }
  }

  if (mejorDistancia > params.toleranciaPx) {
    let lo = mejorAngulo - PASO_ANGULO_GRUESO_GRADOS;
    let hi = mejorAngulo + PASO_ANGULO_GRUESO_GRADOS;
    for (let ronda = 0; ronda < RONDAS_REFINAMIENTO && vuelosSimulados < presupuestoMax; ronda++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;

      let d1 = Infinity;
      if (vuelosSimulados < presupuestoMax) {
        const r1 = volarCandidato(params, origenCanonY, m1, mejorPotencia);
        vuelosSimulados++;
        d1 = r1.perdido ? Infinity : distanciaImpacto(r1.x, params.objetivoX);
        if (d1 < mejorDistancia) {
          mejorDistancia = d1;
          mejorAngulo = m1;
        }
      }
      if (mejorDistancia <= params.toleranciaPx) break;

      let d2 = Infinity;
      if (vuelosSimulados < presupuestoMax) {
        const r2 = volarCandidato(params, origenCanonY, m2, mejorPotencia);
        vuelosSimulados++;
        d2 = r2.perdido ? Infinity : distanciaImpacto(r2.x, params.objetivoX);
        if (d2 < mejorDistancia) {
          mejorDistancia = d2;
          mejorAngulo = m2;
        }
      }
      if (mejorDistancia <= params.toleranciaPx) break;

      if (d1 < d2) hi = m2;
      else lo = m1;
    }
  }

  let sensibilidadPxPorGrado = 0;
  if (vuelosSimulados + 2 <= presupuestoMax) {
    const menos = volarCandidato(params, origenCanonY, mejorAngulo - DELTA_SENSIBILIDAD_GRADOS, mejorPotencia);
    vuelosSimulados++;
    const mas = volarCandidato(params, origenCanonY, mejorAngulo + DELTA_SENSIBILIDAD_GRADOS, mejorPotencia);
    vuelosSimulados++;
    if (!menos.perdido && !mas.perdido) {
      sensibilidadPxPorGrado = Math.abs(mas.x - menos.x) / (2 * DELTA_SENSIBILIDAD_GRADOS);
    } else {
      sensibilidadPxPorGrado = SENSIBILIDAD_MAXIMA_PX_GRADO;
    }
  }

  return {
    anguloGrados: mejorAngulo,
    potencia: mejorPotencia,
    distanciaFinalPx: mejorDistancia,
    sensibilidadPxPorGrado,
    vuelosSimulados,
    agotado: vuelosSimulados >= presupuestoMax && mejorDistancia > params.toleranciaPx,
  };
}
