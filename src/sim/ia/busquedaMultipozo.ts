import { barridoRejilla, PASO_ANGULO_GRUESO_GRADOS, TOTAL_COMBINACIONES_REJILLA } from "@/sim/balistica/rejilla";
import { resolverDisparo } from "@/sim/armas/resolver";
import type { Arma } from "@/sim/armas/tipos";
import type { EstadoAleatorio } from "@/sim/aleatorio";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { NavePosicion } from "@/sim/naves/impacto";
import type { IdNave } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

// ia-multipozo: la búsqueda del rival se construye ENCIMA de barridoRejilla
// (el oráculo único que entrega impacto-naves) -- nunca con una rejilla ni
// una parada de vuelo propias. Tres fases, todas contra resolverDisparo: (1)
// la rejilla gruesa ya construida decide el punto de partida; (2) tres
// rondas de refinamiento ternario alrededor del mejor ángulo grueso, a su
// misma potencia; (3) una sonda de sensibilidad (±0.5°) que mide cuántos px
// 2D se mueve el punto de impacto por grado -- la métrica que decidir.ts usa
// para amortiguar el error de personalidad cerca de un planeta (ia-n5).
// "Acertar" es daño > 0 medido por el resolutor real, nunca una tolerancia
// de proximidad: esa confusión ya costó la iteración 1 de este run (imp-8).
const RONDAS_REFINAMIENTO = 3;
const DELTA_SENSIBILIDAD_GRADOS = 0.5;
// Sin datos de sensibilidad (presupuesto agotado antes de la sonda), se
// declara la sensibilidad más alta posible: decidir.ts la usa para amortiguar
// el error de personalidad, y frente a la duda toca amortiguar de más, nunca
// disparar con el error completo de un tiro que podría rozar un planeta.
const SENSIBILIDAD_SIN_DATOS_PX_GRADO = 500;
export const PRESUPUESTO_VUELOS_RIVAL_DEFAULT = 1200;

export interface ParametrosBusquedaRival {
  readonly mascara: Mascara;
  readonly ancho: number;
  readonly alto: number;
  readonly planetas?: RegistroPlanetas;
  readonly gravedad: number;
  readonly deriva: number;
  readonly aleatorio: EstadoAleatorio;
  // El arma con la que se va a disparar de verdad (decidir.ts la elige antes
  // de llamar aquí): buscar con un arma de referencia distinta a la que
  // termina disparando rompería ia-n2 (la trayectoria que la búsqueda usó
  // para elegir deja de coincidir con la del disparo real en cuanto el arma
  // elegida tiene un comportamiento distinto, como las submuniciones).
  readonly arma: Arma;
  readonly naves: readonly NavePosicion[];
  readonly tiradorId: IdNave;
  readonly objetivoId: IdNave;
  // Techo duro de vuelos simulados para TODO el turno (ia-n3): rejilla más
  // refinamiento más sonda de sensibilidad juntos, nunca solo la rejilla.
  readonly presupuestoVuelosMax?: number;
}

export interface SolucionRival {
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly danioObjetivo: number;
  readonly sensibilidadPxPorGrado: number;
  readonly vuelosSimulados: number;
  // true si se agotó el presupuesto sin encontrar ningún disparo con daño
  // real (ia-n3): el llamante recibe igualmente un mejor esfuerzo, nunca una
  // excepción ni una espera abierta.
  readonly agotado: boolean;
}

function volar(params: ParametrosBusquedaRival, tirador: NavePosicion, objetivo: NavePosicion, anguloGrados: number, potencia: number) {
  return resolverDisparo({
    mascara: params.mascara,
    gravedad: params.gravedad,
    deriva: params.deriva,
    aleatorio: params.aleatorio,
    arma: params.arma,
    origenX: tirador.x,
    origenY: tirador.y,
    anguloGrados,
    potencia,
    objetivoX: objetivo.x,
    objetivoY: objetivo.y,
    ancho: params.ancho,
    alto: params.alto,
    planetas: params.planetas,
    naves: params.naves,
    tiradorId: params.tiradorId,
  });
}

// Sin ambas naves no hay nada que buscar: el llamante (decidir.ts) siempre
// las trae porque ya las necesitó para llegar hasta aquí, pero se cubre el
// caso igual que barridoRejilla/existeTiroViable en vez de asumir.
function solucionSinNaves(): SolucionRival {
  return {
    anguloGrados: 90,
    potencia: 70,
    danioObjetivo: 0,
    sensibilidadPxPorGrado: SENSIBILIDAD_SIN_DATOS_PX_GRADO,
    vuelosSimulados: 0,
    agotado: false,
  };
}

// Rejilla gruesa (fase 1, sobre el oráculo ya construido) + refinamiento
// ternario local (fase 2) + sonda de sensibilidad (fase 3), todo contra
// resolverDisparo y todo dentro de presupuestoVuelosMax (ia-n3). Determinista:
// misma entrada, misma salida, porque cada llamada a resolverDisparo reutiliza
// el mismo `aleatorio` sin encadenarlo -- es una EXPLORACIÓN, no una tirada
// real; el turno que de verdad se dispara avanza su propio aleatorio en
// decidir.ts, no aquí.
export function buscarSolucionRival(params: ParametrosBusquedaRival): SolucionRival {
  const tirador = params.naves.find((nave) => nave.id === params.tiradorId);
  const objetivo = params.naves.find((nave) => nave.id === params.objetivoId);
  if (!tirador || !objetivo) {
    return solucionSinNaves();
  }

  const presupuestoMax = params.presupuestoVuelosMax ?? PRESUPUESTO_VUELOS_RIVAL_DEFAULT;
  const presupuestoRejilla = Math.min(presupuestoMax, TOTAL_COMBINACIONES_REJILLA);
  const candidatos = barridoRejilla({ ...params, presupuestoIntentos: presupuestoRejilla });
  let vuelosSimulados = presupuestoRejilla;

  let mejorAngulo = candidatos[0]?.anguloGrados ?? 90;
  let mejorPotencia = candidatos[0]?.potencia ?? 70;
  let mejorDanio = candidatos[0]?.danio ?? 0;
  const huboCandidato = candidatos.length > 0;

  // Fase 2: refinamiento ternario dentro de la celda gruesa alrededor del
  // mejor candidato, a su misma potencia -- solo tiene sentido si la rejilla
  // ya encontró algo que mejorar y queda presupuesto para al menos una ronda
  // (dos vuelos).
  if (huboCandidato) {
    let lo = mejorAngulo - PASO_ANGULO_GRUESO_GRADOS;
    let hi = mejorAngulo + PASO_ANGULO_GRUESO_GRADOS;
    for (let ronda = 0; ronda < RONDAS_REFINAMIENTO && vuelosSimulados + 2 <= presupuestoMax; ronda++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      const d1 = volar(params, tirador, objetivo, m1, mejorPotencia).danioObjetivo;
      vuelosSimulados++;
      const d2 = volar(params, tirador, objetivo, m2, mejorPotencia).danioObjetivo;
      vuelosSimulados++;
      if (d1 > mejorDanio) {
        mejorDanio = d1;
        mejorAngulo = m1;
      }
      if (d2 > mejorDanio) {
        mejorDanio = d2;
        mejorAngulo = m2;
      }
      if (d1 > d2) hi = m2;
      else lo = m1;
    }
  }

  // Fase 3: sonda de sensibilidad -- cuántos px 2D se mueve el punto de
  // impacto por grado de ángulo alrededor de la solución final. Solo se mide
  // si hubo un candidato real y queda presupuesto para los dos vuelos de la
  // sonda; sin datos, se declara la sensibilidad más alta posible (ver
  // SENSIBILIDAD_SIN_DATOS_PX_GRADO).
  let sensibilidadPxPorGrado = SENSIBILIDAD_SIN_DATOS_PX_GRADO;
  if (huboCandidato && vuelosSimulados + 2 <= presupuestoMax) {
    const menos = volar(params, tirador, objetivo, mejorAngulo - DELTA_SENSIBILIDAD_GRADOS, mejorPotencia);
    vuelosSimulados++;
    const mas = volar(params, tirador, objetivo, mejorAngulo + DELTA_SENSIBILIDAD_GRADOS, mejorPotencia);
    vuelosSimulados++;
    const puntoMenos = menos.puntosDeImpacto[0];
    const puntoMas = mas.puntosDeImpacto[0];
    if (puntoMenos && puntoMas) {
      sensibilidadPxPorGrado = Math.hypot(puntoMas.x - puntoMenos.x, puntoMas.y - puntoMenos.y) / (2 * DELTA_SENSIBILIDAD_GRADOS);
    }
  }

  return {
    anguloGrados: mejorAngulo,
    potencia: mejorPotencia,
    danioObjetivo: mejorDanio,
    sensibilidadPxPorGrado,
    vuelosSimulados,
    agotado: vuelosSimulados >= presupuestoMax && mejorDanio <= 0,
  };
}
