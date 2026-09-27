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
// ia-n4b: la sonda de ángulo NO basta -- el error de potencia de una
// personalidad (Almirante Bisagra, siempre +8 a +20%) puede caer justo sobre
// el umbral de alcance de un tiro con gravedad, donde 1 punto de potencia
// mueve el impacto muchísimo más que en terreno despejado, y ese umbral no
// tiene por qué coincidir con dónde el ángulo es sensible. Se mide aparte,
// con su propia sonda y su propia referencia (percance real de ia-n4:
// Almirante Bisagra salía con más dispersión media que Chispa en 200
// sistemas multipozo hasta que esto se separó del factor de ángulo).
const DELTA_SENSIBILIDAD_POTENCIA = 1;
const SENSIBILIDAD_SIN_DATOS_PX_PORCENTAJE = 500;
// ia-n3: 1.200 es el TECHO DURO que nunca se supera (defensa en profundidad),
// no el gasto real de un turno normal -- con resolverDisparo costando ~1ms
// por vuelo, gastar los 1.200 tardaría más de un segundo, muy por encima del
// techo de 250ms de CPU que exige el mismo criterio. El presupuesto real de
// cada turno es mucho más bajo (ver decidir.ts), y este techo solo protege
// contra un llamante que pida explícitamente más de la cuenta.
export const PRESUPUESTO_VUELOS_RIVAL_DEFAULT = 1200;
// Cuántos vuelos se apartan SIEMPRE para el refinamiento (3 rondas x 2) y las
// dos sondas de sensibilidad (2 de ángulo + 2 de potencia), antes de dársela
// a la rejilla -- sin esto, un presupuesto por debajo de
// TOTAL_COMBINACIONES_REJILLA deja la rejilla entera con todo el presupuesto
// y apaga las fases 2 y 3 por completo en cuanto el llamante pide menos que
// la rejilla completa.
const VUELOS_RESERVADOS_REFINAMIENTO_Y_SENSIBILIDAD = RONDAS_REFINAMIENTO * 2 + 2 + 2;
// Presupuesto real que usa decidir.ts en un turno normal (ia-n3, techo de
// 250ms de CPU medido en CI): cubre la rejilla entera para las tres potencias
// centrales (40/55/70%) más una parte de las dos más altas, y dentro de eso
// siempre le queda hueco al refinamiento y a las dos sondas -- medido
// empíricamente para quedar con margen bajo el techo, no en el borde.
export const PRESUPUESTO_VUELOS_RIVAL_TURNO = 192;

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
  // px 2D que se mueve el punto de impacto por punto porcentual de potencia
  // (ia-n4b): separado de sensibilidadPxPorGrado porque el umbral de alcance
  // de un tiro con gravedad no tiene por qué coincidir en ángulo y potencia.
  readonly sensibilidadPxPorPorcentajePotencia: number;
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
    sensibilidadPxPorPorcentajePotencia: SENSIBILIDAD_SIN_DATOS_PX_PORCENTAJE,
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

  const presupuestoMax = params.presupuestoVuelosMax ?? PRESUPUESTO_VUELOS_RIVAL_TURNO;
  const presupuestoRejilla = Math.min(
    TOTAL_COMBINACIONES_REJILLA,
    Math.max(0, presupuestoMax - VUELOS_RESERVADOS_REFINAMIENTO_Y_SENSIBILIDAD),
  );
  const candidatos = barridoRejilla({ ...params, presupuestoIntentos: presupuestoRejilla });
  let vuelosSimulados = presupuestoRejilla;

  let mejorAngulo = candidatos[0]?.anguloGrados ?? 90;
  const mejorPotencia = candidatos[0]?.potencia ?? 70;
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

  // Fase 4: sonda de sensibilidad de potencia -- misma idea que la de ángulo,
  // pero perturbando potencia (acotada a [0, 100]: el denominador usa el
  // delta REAL tras el recorte, no 2*DELTA_SENSIBILIDAD_POTENCIA, para no
  // subestimar la sensibilidad justo en el candidato de potencia 100%).
  let sensibilidadPxPorPorcentajePotencia = SENSIBILIDAD_SIN_DATOS_PX_PORCENTAJE;
  if (huboCandidato && vuelosSimulados + 2 <= presupuestoMax) {
    const potenciaMenos = Math.max(0, mejorPotencia - DELTA_SENSIBILIDAD_POTENCIA);
    const potenciaMas = Math.min(100, mejorPotencia + DELTA_SENSIBILIDAD_POTENCIA);
    const menos = volar(params, tirador, objetivo, mejorAngulo, potenciaMenos);
    vuelosSimulados++;
    const mas = volar(params, tirador, objetivo, mejorAngulo, potenciaMas);
    vuelosSimulados++;
    const puntoMenos = menos.puntosDeImpacto[0];
    const puntoMas = mas.puntosDeImpacto[0];
    const deltaReal = potenciaMas - potenciaMenos;
    if (puntoMenos && puntoMas && deltaReal > 0) {
      sensibilidadPxPorPorcentajePotencia = Math.hypot(puntoMas.x - puntoMenos.x, puntoMas.y - puntoMenos.y) / deltaReal;
    }
  }

  return {
    anguloGrados: mejorAngulo,
    potencia: mejorPotencia,
    danioObjetivo: mejorDanio,
    sensibilidadPxPorGrado,
    sensibilidadPxPorPorcentajePotencia,
    vuelosSimulados,
    agotado: vuelosSimulados >= presupuestoMax && mejorDanio <= 0,
  };
}
