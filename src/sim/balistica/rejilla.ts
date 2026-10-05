import { resolverDisparo } from "@/sim/armas/resolver";
import type { Arma } from "@/sim/armas/tipos";
import type { EstadoAleatorio } from "@/sim/aleatorio";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { NavePosicion } from "@/sim/naves/impacto";
import type { IdNave } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS } from "@/juego/control/apuntado";

// UN SOLO ORÁCULO DE TIRO (imp-8): esto REEMPLAZA por completo a
// src/sim/balistica/busqueda.ts (borrado en este mismo bloque), que tenía su
// propia condición de parada privada -- paraba en cuanto el proyectil
// llegaba a 60px 2D del objetivo, sin comprobar si eso causaba daño de
// verdad ni si había una nave real de por medio. Aquí no hay ninguna
// condición de parada propia: barridoRejilla llama a resolverDisparo, el
// MISMO resolutor que resuelve un disparo real de partida (vuelo real +
// parada real + catálogo real), y decide viabilidad por su daño de salida,
// nunca por una distancia aproximada.
// Exportado (ia-multipozo): el refinamiento local del rival necesita saber
// el ancho de la celda gruesa alrededor de su mejor candidato para acotar la
// ventana de refinamiento -- reexportar el número evita que busquedaMultipozo.ts
// se invente su propia copia que pueda desincronizarse de la rejilla real.
export const PASO_ANGULO_GRUESO_GRADOS = 4;
// Exportados (ia-multipozo): el rival necesita el mismo rango para acotar su
// disparo de emergencia cuando la rejilla entera no encuentra ni un solo
// candidato con daño real -- un límite propio que se desincronice de este
// dejaría pasar un ángulo que la rejilla ni siquiera prueba.
export const ANGULO_MIN_GRADOS = 2;
export const ANGULO_MAX_GRADOS = 180 - ANGULO_MIN_GRADOS;
// apuntado-y-relevo (apu-5): la rejilla de la IA y de la medición de armas
// conserva el semicírculo superior porque la facilidad medida (y con ella los
// precios) se calibró con él. La viabilidad de la colocación, en cambio,
// tiene que preguntar por todo lo que el jugador puede disparar: se pasa
// RANGO_ANGULOS_JUGADOR. El último paso grueso antes de 360° evita repetir
// el 0° como 360°.
export interface RangoAngulos {
  readonly minimo: number;
  readonly maximo: number;
}
export const RANGO_ANGULOS_IA: RangoAngulos = { minimo: ANGULO_MIN_GRADOS, maximo: ANGULO_MAX_GRADOS };
export const RANGO_ANGULOS_JUGADOR: RangoAngulos = {
  minimo: ANGULO_MINIMO_GRADOS,
  maximo: ANGULO_MAXIMO_GRADOS - PASO_ANGULO_GRUESO_GRADOS,
};
const POTENCIAS_PROBADAS_PORCENTAJE = [40, 55, 70, 85, 100];
// Exportado (ia-multipozo): cuántos vuelos consume barrer la rejilla entera
// sin presupuesto -- el rival lo necesita para repartir su propio techo de
// vuelos (ia-n3) entre la fase de rejilla y la de refinamiento.
export const TOTAL_COMBINACIONES_REJILLA =
  POTENCIAS_PROBADAS_PORCENTAJE.length * (Math.floor((ANGULO_MAX_GRADOS - ANGULO_MIN_GRADOS) / PASO_ANGULO_GRUESO_GRADOS) + 1);

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
  // Ausente = semicírculo de la IA (ANGULO_MIN/MAX_GRADOS).
  readonly rangoAngulos?: RangoAngulos;
}

export interface CandidatoDisparo {
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly danio: number;
  // ia-autodanio: autodanioTotal junta las dos vías de hacerse daño a sí
  // mismo que expone resolverDisparo -- danioPropio (garantizado, p.ej.
  // "Despedida") e impactoPropio.danio (por gravedad, un disparo curvo que
  // vuelve a golpear el propio casco). puntuacion es lo que ordena de
  // verdad: ver PESO_AUTODANIO y compararCandidatos más abajo.
  readonly autodanioTotal: number;
  readonly puntuacion: number;
  // armas-metrica: pasos de vuelo (ver ResultadoDisparo.pasosVuelo) del
  // candidato -- aditivo, nadie más lo leía hasta ahora. Permite calcular
  // "tiempo de vuelo medio" sobre los MISMOS candidatos que ya acepta
  // barridoRejilla, sin un segundo barrido de la rejilla aparte.
  readonly pasosVuelo: number;
}

// ia-autodanio-1: peso >=2 para que un candidato con autodaño nunca gane por
// puntuación a uno sin autodaño que haga igual o menos del doble de daño --
// en la práctica da igual porque compararCandidatos ya separa en dos grupos
// (seguro vs. con autodaño) antes de mirar la puntuación, pero el peso sigue
// marcando el orden DENTRO del grupo con autodaño.
export const PESO_AUTODANIO = 2;

// ia-autodanio-1: nunca elegir un candidato que se hace daño a sí mismo
// mientras exista uno sin autodaño con daño real al objetivo -- por eso la
// separación en dos grupos va ANTES que la puntuación, no mezclada con ella.
export function compararCandidatos(a: CandidatoDisparo, b: CandidatoDisparo): number {
  const aSeguro = a.autodanioTotal === 0;
  const bSeguro = b.autodanioTotal === 0;
  if (aSeguro !== bSeguro) return aSeguro ? -1 : 1;
  return b.puntuacion - a.puntuacion;
}

function* combinacionesDeLaRejilla(rango: RangoAngulos): Generator<{ anguloGrados: number; potencia: number }> {
  for (const potencia of POTENCIAS_PROBADAS_PORCENTAJE) {
    for (let anguloGrados = rango.minimo; anguloGrados <= rango.maximo; anguloGrados += PASO_ANGULO_GRUESO_GRADOS) {
      yield { anguloGrados, potencia };
    }
  }
}

interface ResultadoCandidato {
  readonly danio: number;
  readonly autodanioTotal: number;
  readonly puntuacion: number;
  readonly pasosVuelo: number;
}

function danioDelCandidato(
  params: ParametrosBarridoRejilla,
  tirador: NavePosicion,
  objetivo: NavePosicion,
  anguloGrados: number,
  potencia: number,
): ResultadoCandidato {
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
  const autodanioTotal = resultado.danioPropio + (resultado.impactoPropio?.danio ?? 0);
  return {
    danio: resultado.danioObjetivo,
    autodanioTotal,
    puntuacion: resultado.danioObjetivo - PESO_AUTODANIO * autodanioTotal,
    pasosVuelo: resultado.pasosVuelo,
  };
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
  for (const { anguloGrados, potencia } of combinacionesDeLaRejilla(params.rangoAngulos ?? RANGO_ANGULOS_IA)) {
    if (params.presupuestoIntentos !== undefined && evaluados >= params.presupuestoIntentos) break;
    evaluados++;
    const resultado = danioDelCandidato(params, tirador, objetivo, anguloGrados, potencia);
    if (resultado.danio > 0) {
      candidatos.push({
        anguloGrados,
        potencia,
        danio: resultado.danio,
        autodanioTotal: resultado.autodanioTotal,
        puntuacion: resultado.puntuacion,
        pasosVuelo: resultado.pasosVuelo,
      });
    }
  }

  return candidatos.sort(compararCandidatos);
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
  for (const { anguloGrados, potencia } of combinacionesDeLaRejilla(params.rangoAngulos ?? RANGO_ANGULOS_IA)) {
    if (params.presupuestoIntentos !== undefined && evaluados >= params.presupuestoIntentos) return false;
    evaluados++;
    if (danioDelCandidato(params, tirador, objetivo, anguloGrados, potencia).danio > 0) return true;
  }
  return false;
}
