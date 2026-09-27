import { resolverDisparo } from "@/sim/armas/resolver";
import type { Arma } from "@/sim/armas/tipos";
import type { EstadoAleatorio } from "@/sim/aleatorio";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { NavePosicion } from "@/sim/naves/impacto";
import type { IdNave } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

// UN SOLO ORÁCULO DE TIRO (imp-8): esto REEMPLAZA por completo a
// src/sim/balistica/busqueda.ts (borrado en este mismo bloque), que tenía su
// propia condición de parada privada -- paraba en cuanto el proyectil
// llegaba a 60px 2D del objetivo, sin comprobar si eso causaba daño de
// verdad ni si había una nave real de por medio. Aquí no hay ninguna
// condición de parada propia: barridoRejilla llama a resolverDisparo, el
// MISMO resolutor que resuelve un disparo real de partida (vuelo real +
// parada real + catálogo real), y decide viabilidad por su daño de salida,
// nunca por una distancia aproximada.
const PASO_ANGULO_GRUESO_GRADOS = 4;
const ANGULO_MIN_GRADOS = 2;
const ANGULO_MAX_GRADOS = 178;
const POTENCIAS_PROBADAS_PORCENTAJE = [40, 55, 70, 85, 100];

export interface ParametrosBarridoRejilla {
  readonly mascara: Mascara;
  readonly ancho: number;
  readonly alto: number;
  readonly planetas?: RegistroPlanetas;
  readonly gravedad: number;
  readonly deriva: number;
  readonly aleatorio: EstadoAleatorio;
  readonly arma: Arma;
  readonly naves: readonly NavePosicion[];
  readonly tiradorId: IdNave;
  readonly objetivoId: IdNave;
  // Cuántas combinaciones ángulo x potencia probar como máximo antes de
  // rendirse (presupuesto-de-cómputo, imp-10): colocarNaves llama a esto
  // muchas veces por semilla y necesita un tope estricto; las
  // verificaciones desde fuera (nav-3, imp-8, imp-9), una sola vez por
  // semilla, no lo pasan y agotan la rejilla completa. Ausente = sin
  // límite.
  readonly presupuestoIntentos?: number;
}

export interface CandidatoDisparo {
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly danio: number;
}

function* combinacionesDeLaRejilla(): Generator<{ anguloGrados: number; potencia: number }> {
  for (const potencia of POTENCIAS_PROBADAS_PORCENTAJE) {
    for (let anguloGrados = ANGULO_MIN_GRADOS; anguloGrados <= ANGULO_MAX_GRADOS; anguloGrados += PASO_ANGULO_GRUESO_GRADOS) {
      yield { anguloGrados, potencia };
    }
  }
}

function danioDelCandidato(
  params: ParametrosBarridoRejilla,
  tirador: NavePosicion,
  objetivo: NavePosicion,
  anguloGrados: number,
  potencia: number,
): number {
  const resultado = resolverDisparo({
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
  return resultado.danioObjetivo;
}

// Barrido de ángulo x potencia sobre el vuelo real y el resolutor real:
// devuelve todos los candidatos que causan daño > 0 a la nave objetivo,
// ordenados de mayor a menor daño. Vacío si ninguno acierta con daño real.
export function barridoRejilla(params: ParametrosBarridoRejilla): readonly CandidatoDisparo[] {
  const tirador = params.naves.find((nave) => nave.id === params.tiradorId);
  const objetivo = params.naves.find((nave) => nave.id === params.objetivoId);
  if (!tirador || !objetivo) {
    return [];
  }

  const candidatos: CandidatoDisparo[] = [];
  let evaluados = 0;
  for (const { anguloGrados, potencia } of combinacionesDeLaRejilla()) {
    if (params.presupuestoIntentos !== undefined && evaluados >= params.presupuestoIntentos) break;
    evaluados++;
    const danio = danioDelCandidato(params, tirador, objetivo, anguloGrados, potencia);
    if (danio > 0) {
      candidatos.push({ anguloGrados, potencia, danio });
    }
  }

  return candidatos.sort((a, b) => b.danio - a.danio);
}

// Usado por colocarNaves (aceptar/rechazar una disposición) y, en el
// siguiente bloque, por la búsqueda del rival (que le añade refinamiento
// local y presupuesto de cómputo) -- ambos comparten el mismo oráculo. A
// diferencia de barridoRejilla (que explora TODA la rejilla para poder
// rankear), esto se rinde en cuanto encuentra un solo candidato con daño
// real: nunca hace falta rankear para responder sí/no.
export function existeTiroViable(params: ParametrosBarridoRejilla): boolean {
  const tirador = params.naves.find((nave) => nave.id === params.tiradorId);
  const objetivo = params.naves.find((nave) => nave.id === params.objetivoId);
  if (!tirador || !objetivo) {
    return false;
  }

  let evaluados = 0;
  for (const { anguloGrados, potencia } of combinacionesDeLaRejilla()) {
    if (params.presupuestoIntentos !== undefined && evaluados >= params.presupuestoIntentos) return false;
    evaluados++;
    if (danioDelCandidato(params, tirador, objetivo, anguloGrados, potencia) > 0) return true;
  }
  return false;
}
