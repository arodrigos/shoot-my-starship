import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { esSolido, type Mascara } from "@/sim/terreno/mascara";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";

// Rejilla gruesa + refinamiento local: esto NO es el resolutor del rival
// (ia-multipozo, bloque posterior, que reutilizará simularVuelo con su
// propia rejilla y refinamiento pensados para jugar, no solo para
// comprobar viabilidad), es el comprobante barato de que una colocación de
// naves es jugable. Solo la rejilla gruesa no basta: con gravedad de varios
// cuerpos de por medio la distancia final no varía suave ni monótonamente
// con el ángulo, así que dos candidatos a PASO_ANGULO_GRUESO_GRADOS de
// separación pueden tener uno un impacto limpio y el vecino un fallo por
// varios px -- de ahí el refinamiento por búsqueda ternaria alrededor del
// mejor candidato de la rejilla.
const PASO_ANGULO_GRUESO_GRADOS = 4;
const ANGULO_MIN_GRADOS = 2;
const ANGULO_MAX_GRADOS = 178;
const POTENCIAS_PROBADAS_PORCENTAJE = [40, 55, 70, 85, 100];
const ITERACIONES_REFINAMIENTO = 12;
// ~5s de vuelo simulado: de sobra para descartar o confirmar un disparo
// entre dos naves a las distancias que garantiza colocarNaves, sin gastar
// los ~12s completos de PRESUPUESTO_VUELO_MULTIPOZO_PASOS en cada intento
// de las 500 semillas de nav-3.
const PRESUPUESTO_PASOS_BUSQUEDA = 300;

export interface ParametrosBusquedaDisparo {
  readonly mascara: Mascara;
  readonly ancho: number;
  readonly alto: number;
  readonly planetas: RegistroPlanetas;
  readonly gravedad: number;
  readonly deriva: number;
  readonly origenX: number;
  readonly origenY: number;
  readonly objetivoX: number;
  readonly objetivoY: number;
  readonly toleranciaPx: number;
}

export interface DisparoEncontrado {
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly distanciaFinalPx: number;
}

function distancia(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Vuela un único disparo y devuelve a qué distancia del objetivo termina
// (Infinity si se pierde por presupuesto): la unidad mínima que tanto la
// rejilla gruesa como el refinamiento reutilizan sin duplicar la llamada a
// simularVuelo.
function distanciaFinalDelDisparo(
  params: ParametrosBusquedaDisparo,
  origenCanonY: number,
  anguloGrados: number,
  potencia: number,
): number {
  const v = velocidadDesdePotencia(potencia);
  const rad = (anguloGrados * Math.PI) / 180;
  const inicial: EstadoProyectil = crearProyectil(params.origenX, origenCanonY, v * Math.cos(rad), -v * Math.sin(rad));

  const detenerse = (proyectil: EstadoProyectil): boolean => {
    if (proyectil.y >= params.alto || proyectil.x < 0 || proyectil.x >= params.ancho) return true;
    if (esSolido(params.mascara, Math.round(proyectil.x), Math.round(proyectil.y))) return true;
    return distancia(proyectil.x, proyectil.y, params.objetivoX, params.objetivoY) <= params.toleranciaPx;
  };

  const { proyectil, perdido } = simularVuelo(inicial, params.gravedad, params.deriva, detenerse, {
    planetas: params.planetas,
    presupuestoPasos: PRESUPUESTO_PASOS_BUSQUEDA,
  });
  if (perdido) return Infinity;
  return distancia(proyectil.x, proyectil.y, params.objetivoX, params.objetivoY);
}

// Busca un disparo balístico (ángulo x potencia) que acerque el proyectil al
// objetivo a menos de `toleranciaPx`, reutilizando simularVuelo tal cual --
// nunca un modelo simplificado de la trayectoria: es la misma función que
// resuelve un disparo real, así que "hay tiro posible" aquí significa
// exactamente lo mismo que en la partida.
//
// Rejilla gruesa primero (barata, cubre todo el rango de ángulos); si nada
// cae dentro de tolerancia, se refina por búsqueda ternaria alrededor del
// mejor candidato de la rejilla, a la potencia que lo produjo. Con gravedad
// de varios cuerpos la distancia final no es monótona en el ángulo, así que
// el refinamiento no garantiza encontrar el óptimo global -- pero sí basta,
// en la práctica, para cerrar el hueco que dos candidatos vecinos de la
// rejilla dejan entre "casi" y "dentro de tolerancia" (ver nav-3).
export function buscarDisparoViable(params: ParametrosBusquedaDisparo): DisparoEncontrado | null {
  const origenCanonY = params.origenY - ALTURA_CANON_PX;

  let mejorDistancia = Infinity;
  let mejorAngulo = ANGULO_MIN_GRADOS;
  let mejorPotencia = POTENCIAS_PROBADAS_PORCENTAJE[0];

  for (const potencia of POTENCIAS_PROBADAS_PORCENTAJE) {
    for (let angulo = ANGULO_MIN_GRADOS; angulo <= ANGULO_MAX_GRADOS; angulo += PASO_ANGULO_GRUESO_GRADOS) {
      const distanciaFinal = distanciaFinalDelDisparo(params, origenCanonY, angulo, potencia);
      if (distanciaFinal <= params.toleranciaPx) {
        return { anguloGrados: angulo, potencia, distanciaFinalPx: distanciaFinal };
      }
      if (distanciaFinal < mejorDistancia) {
        mejorDistancia = distanciaFinal;
        mejorAngulo = angulo;
        mejorPotencia = potencia;
      }
    }
  }

  if (mejorDistancia === Infinity) return null;

  let lo = mejorAngulo - PASO_ANGULO_GRUESO_GRADOS;
  let hi = mejorAngulo + PASO_ANGULO_GRUESO_GRADOS;
  for (let iteracion = 0; iteracion < ITERACIONES_REFINAMIENTO; iteracion++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const d1 = distanciaFinalDelDisparo(params, origenCanonY, m1, mejorPotencia);
    if (d1 <= params.toleranciaPx) return { anguloGrados: m1, potencia: mejorPotencia, distanciaFinalPx: d1 };
    const d2 = distanciaFinalDelDisparo(params, origenCanonY, m2, mejorPotencia);
    if (d2 <= params.toleranciaPx) return { anguloGrados: m2, potencia: mejorPotencia, distanciaFinalPx: d2 };

    if (d1 < mejorDistancia) mejorDistancia = d1;
    if (d2 < mejorDistancia) mejorDistancia = d2;
    if (d1 < d2) hi = m2;
    else lo = m1;
  }

  return null;
}
