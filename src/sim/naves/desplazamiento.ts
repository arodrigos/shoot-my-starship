import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { RADIO_ENVOLVENTE_NAVE_PX } from "@/sim/naves/geometriaCasco";
import { chocaConOtraNave, esPosicionValida, limitesNave, type PuntoNave } from "@/sim/naves/zonaValida";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

const RESPIRO_FUERA_DEL_AREA_U = 8;
// Longitud del paso de integración del recorrido: lo bastante corto para que
// ninguna nave salte un planeta o un borde y lo bastante largo para que el
// recorrido entero sean unas decenas de puntos que la cáscara puede animar.
export const PASO_EMPUJE_U = 4;
// Separación entre los destinos que se prueban contra «Repetir no acierta»
// cuando el destino natural lo falla.
export const TRAMO_PROLONGACION_U = 8;
// Un desvío lateral pegado al impacto acierta a veces con otra dispersión de potencia; el margen lo evita.
const DESVIO_LATERAL_MINIMO_U = 40;
const BASES_LATERALES_CADA_PASOS = 8;
const MAX_COMPROBACIONES_LATERALES = 160;
// Cada comprobación de descartar simula un disparo entero; el tope mantiene
// acotado el coste de cerrar el turno aunque el Worker lo haga fuera del hilo.
export const MAX_COMPROBACIONES_DESCARTAR = 64;
// Cuánto se curva el recorrido por la aceleración de los pozos. Con la
// constante gravitacional del juego, un planeta típico a ~200 u del recorrido
// gira la dirección unos 3° por paso: se nota sin convertirlo en una órbita.
export const K_CURVA_EMPUJE = 0.00002;

// «ninguna» = el destino natural (o uno de su prolongación) cumple el
// descartar; «lateral» = ningún punto del recorrido lo cumplía (el mismo tiro
// sigue pasando por la trayectoria) y la nave se aparta de ella; «mas-lejano» =
// tampoco había salida lateral y se usa el más lejano del recorrido;
// «se-queda» = ni siquiera hay un primer paso válido.
export type ReservaDesplazamiento = "ninguna" | "lateral" | "mas-lejano" | "se-queda";
export type MotivoParadaEmpuje = "longitud" | "planeta" | "nave" | "esquina";

export interface ResultadoDesplazamiento {
  readonly x: number;
  readonly y: number;
  readonly reserva: ReservaDesplazamiento;
  // Puntos del recorrido que la cáscara anima, desde el origen hasta el destino.
  readonly puntos: readonly PuntoNave[];
  readonly motivoParada: MotivoParadaEmpuje;
}

// Un octavo de la diagonal del mundo: el radio que pidió Adrián para que
// repetir el mismo disparo ya no acierte.
export function octavoDelMundo(mundo: ParametrosMundo): number {
  return Math.hypot(mundo.ancho, mundo.alto) / 8;
}

// d_min deja la nave fuera del área del arma que acaba de golpearla; si el
// área es mayor que el octavo, el máximo posible es el propio octavo.
export function distanciaMinimaDesplazamiento(mundo: ParametrosMundo, radioEfectoU: number): number {
  return Math.min(octavoDelMundo(mundo), RADIO_ENVOLVENTE_NAVE_PX + radioEfectoU + RESPIRO_FUERA_DEL_AREA_U);
}

// D = d_min + (OCTAVO - d_min) × min(1, daño / dañoMáximo): más daño, más lejos.
export function longitudDeEmpuje(mundo: ParametrosMundo, radioEfectoU: number, danio: number, danioMaximo: number): number {
  const minima = distanciaMinimaDesplazamiento(mundo, radioEfectoU);
  const fraccion = danioMaximo > 0 ? Math.min(1, Math.max(0, danio / danioMaximo)) : 1;
  return minima + (octavoDelMundo(mundo) - minima) * fraccion;
}

export interface ParametrosRecorrido {
  readonly desde: PuntoNave;
  // Dirección del empuje; se normaliza aquí. Un vector nulo empuja hacia arriba.
  readonly direccion: PuntoNave;
  // Longitud D del recorrido natural.
  readonly longitud: number;
  readonly mundo: ParametrosMundo;
  readonly mascara: Mascara;
  readonly pozos?: RegistroPlanetas;
  readonly otras: readonly PuntoNave[];
}

export interface ParametrosRecolocacion extends ParametrosRecorrido {
  // Rechaza un destino por una razón que la geometría no ve (p. ej. que el
  // mismo disparo, repetido, volviera a darle ahí). Va aparte de
  // esPosicionValida porque necesita el simulador de vuelo, que no es suyo.
  readonly descartar?: (punto: PuntoNave) => boolean;
}

export interface RecorridoEmpuje {
  readonly puntos: readonly PuntoNave[];
  readonly final: PuntoNave;
  readonly motivoParada: MotivoParadaEmpuje;
}

interface Camino {
  readonly puntos: readonly PuntoNave[];
  // Longitud acumulada en cada punto (distancias[0] = 0).
  readonly distancias: readonly number[];
  // null = llegó a la longitud pedida sin toparse con nada.
  readonly parada: Exclude<MotivoParadaEmpuje, "longitud"> | null;
}

function normalizar(v: PuntoNave, porDefecto: PuntoNave): PuntoNave {
  const norma = Math.hypot(v.x, v.y);
  return norma > 1e-9 ? { x: v.x / norma, y: v.y / norma } : porDefecto;
}

type EjeBloqueado = "x" | "y" | null;

// Recorrido simulado y determinista (sin azar): sale en `direccion`, se curva
// con la aceleración de los pozos y, si topa con un borde, desliza a lo largo
// de él en el sentido de la componente tangencial sin acortarse. Se calcula
// hasta la longitud que se pida; recolocarTrasImpacto lo traza hasta OCTAVO
// para que la prolongación de «Repetir no acierta» recorra la MISMA trayectoria.
function trazarCamino(parametros: ParametrosRecorrido, hasta: number): Camino {
  const { desde, mundo, mascara, pozos, otras } = parametros;
  const limites = limitesNave(mundo);
  const centro = { x: (limites.xMin + limites.xMax) / 2, y: (limites.yMin + limites.yMax) / 2 };
  const puntos: PuntoNave[] = [desde];
  const distancias: number[] = [0];
  let direccion = normalizar(parametros.direccion, { x: 0, y: -1 });
  let pos = desde;
  let recorrido = 0;
  let eje: EjeBloqueado = null;
  let parada: Camino["parada"] = null;
  const maxPasos = Math.ceil(hasta / PASO_EMPUJE_U) + 1;

  for (let i = 0; i < maxPasos && recorrido < hasta - 1e-9; i++) {
    const a = pozos !== undefined && pozos.length > 0 ? calcularAceleracionGravitatoria(pozos, pos.x, pos.y) : { x: 0, y: 0 };
    let dir = normalizar({ x: direccion.x + K_CURVA_EMPUJE * a.x * PASO_EMPUJE_U, y: direccion.y + K_CURVA_EMPUJE * a.y * PASO_EMPUJE_U }, direccion);
    const paso = Math.min(PASO_EMPUJE_U, hasta - recorrido);
    let siguiente = { x: pos.x + dir.x * paso, y: pos.y + dir.y * paso };

    const fueraX = siguiente.x < limites.xMin || siguiente.x > limites.xMax;
    const fueraY = siguiente.y < limites.yMin || siguiente.y > limites.yMax;
    if (fueraX && fueraY) {
      parada = "esquina";
      break;
    }
    if (fueraX) eje = "x";
    else if (fueraY) eje = "y";
    if (eje !== null) {
      // Se anula la componente normal al borde y la tangencial manda el
      // sentido; con componente 0 exacta, hacia el centro del borde.
      const tangencial = eje === "x" ? dir.y : dir.x;
      const haciaCentro = eje === "x" ? Math.sign(centro.y - pos.y) : Math.sign(centro.x - pos.x);
      const signo = Math.abs(tangencial) > 1e-9 ? Math.sign(tangencial) : haciaCentro || 1;
      dir = eje === "x" ? { x: 0, y: signo } : { x: signo, y: 0 };
      siguiente = { x: pos.x + dir.x * paso, y: pos.y + dir.y * paso };
      const fueraEnOtroEje = eje === "x" ? siguiente.y < limites.yMin || siguiente.y > limites.yMax : siguiente.x < limites.xMin || siguiente.x > limites.xMax;
      if (fueraEnOtroEje) {
        parada = "esquina";
        break;
      }
    }

    if (chocaConOtraNave(siguiente, otras)) {
      parada = "nave";
      break;
    }
    if (!esPosicionValida(siguiente, mundo, mascara, otras)) {
      parada = "planeta";
      break;
    }
    direccion = dir;
    pos = siguiente;
    recorrido += paso;
    puntos.push(pos);
    distancias.push(recorrido);
  }
  return { puntos, distancias, parada };
}

function recortarHasta(camino: Camino, longitud: number): { puntos: readonly PuntoNave[]; recorrido: number } {
  let ultimo = 0;
  for (let i = 0; i < camino.distancias.length; i++) {
    if (camino.distancias[i] <= longitud + 1e-9) ultimo = i;
  }
  return { puntos: camino.puntos.slice(0, ultimo + 1), recorrido: camino.distancias[ultimo] };
}

// El recorrido natural de longitud D, sin el descartar de «Repetir».
export function recorrerEmpuje(parametros: ParametrosRecorrido): RecorridoEmpuje {
  const camino = trazarCamino(parametros, parametros.longitud);
  return { puntos: camino.puntos, final: camino.puntos[camino.puntos.length - 1], motivoParada: camino.parada ?? "longitud" };
}

// Sustituye al destino sorteado: la nave sigue la trayectoria del disparo.
// Si el destino natural (a D) deja que el mismo disparo repetido vuelva a
// darle, se prueban puntos más lejos de la MISMA trayectoria, cada
// TRAMO_PROLONGACION_U, hasta OCTAVO.
export function recolocarTrasImpacto(parametros: ParametrosRecolocacion): ResultadoDesplazamiento {
  const { desde, mundo, descartar } = parametros;
  const octavo = octavoDelMundo(mundo);
  const longitud = Math.min(parametros.longitud, octavo);
  const camino = trazarCamino(parametros, octavo);
  const motivoDe = (puntos: readonly PuntoNave[]): MotivoParadaEmpuje => (puntos.length === camino.puntos.length ? (camino.parada ?? "longitud") : "longitud");

  const natural = recortarHasta(camino, longitud);
  // Sin primer paso válido la nave se queda, salvo que «Repetir» exija apartarla.
  if (natural.puntos.length === 1 && descartar === undefined) {
    return { x: desde.x, y: desde.y, reserva: "se-queda", puntos: natural.puntos, motivoParada: camino.parada ?? "longitud" };
  }
  const destino = natural.puntos[natural.puntos.length - 1];
  // Si el recorrido se paró antes de D por un obstáculo, ese es el motivo.
  const motivoNatural = natural.recorrido < longitud - PASO_EMPUJE_U ? (camino.parada ?? "longitud") : motivoDe(natural.puntos);
  if (descartar === undefined || !descartar(destino)) {
    return { x: destino.x, y: destino.y, reserva: "ninguna", puntos: natural.puntos, motivoParada: motivoNatural };
  }

  const alcance = camino.distancias[camino.distancias.length - 1];
  let comprobaciones = 1;
  let masLejos = natural;
  // El último candidato es siempre el alcance entero, aunque no caiga en la rejilla de tramos.
  for (let candidata = natural.recorrido + TRAMO_PROLONGACION_U; natural.recorrido < alcance - 1e-9 && masLejos.recorrido < alcance - 1e-9 && comprobaciones < MAX_COMPROBACIONES_DESCARTAR; candidata += TRAMO_PROLONGACION_U) {
    const distancia = Math.min(candidata, alcance);
    const tramo = recortarHasta(camino, distancia);
    const punto = tramo.puntos[tramo.puntos.length - 1];
    masLejos = tramo;
    comprobaciones++;
    if (!descartar(punto)) return { x: punto.x, y: punto.y, reserva: "ninguna", puntos: tramo.puntos, motivoParada: motivoDe(tramo.puntos) };
  }
  // «Repetir no acierta» manda sobre la dirección exacta: una nave empujada
  // por la línea del tiro sigue en la línea del tiro, así que como último
  // recurso se aparta de ella, a un lado y a otro del destino natural.
  const largoDireccion = Math.hypot(parametros.direccion.x, parametros.direccion.y);
  const normal = largoDireccion > 0 ? { x: -parametros.direccion.y / largoDireccion, y: parametros.direccion.x / largoDireccion } : { x: 1, y: 0 };
  // Bases: el destino natural y puntos anteriores del recorrido, por si a su
  // lado no hay sitio válido. Un candidato exige margen a ambos lados porque
  // el disparo repetido tiene otra dispersión de potencia.
  const bases: PuntoNave[] = [];
  for (let i = natural.puntos.length - 1; i >= 0; i -= BASES_LATERALES_CADA_PASOS) bases.push(natural.puntos[i]);
  const libre = (punto: PuntoNave): boolean => !descartar(punto);
  for (let desvio = DESVIO_LATERAL_MINIMO_U; desvio <= octavo && comprobaciones < MAX_COMPROBACIONES_LATERALES; desvio += TRAMO_PROLONGACION_U) {
    for (const base of bases) {
      for (const lado of [1, -1]) {
        if (comprobaciones >= MAX_COMPROBACIONES_LATERALES) break;
        const punto = { x: base.x + lado * desvio * normal.x, y: base.y + lado * desvio * normal.y };
        if (!esPosicionValida(punto, mundo, parametros.mascara, parametros.otras)) continue;
        comprobaciones++;
        const vecino = { x: punto.x + lado * TRAMO_PROLONGACION_U * normal.x, y: punto.y + lado * TRAMO_PROLONGACION_U * normal.y };
        if (libre(punto) && (!esPosicionValida(vecino, mundo, parametros.mascara, parametros.otras) || libre(vecino))) {
          return { x: punto.x, y: punto.y, reserva: "lateral", puntos: [...natural.puntos, punto], motivoParada: "longitud" };
        }
      }
    }
  }
  const final = masLejos.puntos[masLejos.puntos.length - 1];
  return { x: final.x, y: final.y, reserva: "mas-lejano", puntos: masLejos.puntos, motivoParada: motivoDe(masLejos.puntos) };
}
