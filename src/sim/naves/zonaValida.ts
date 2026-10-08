import {
  franjaInferiorU,
  HOLGURA_SOLIDO_NAVE_PX,
  libreDeSolido,
  MARGEN_MUNDO_NAVE_PX,
} from "@/sim/naves/colocacion";
import { RADIO_ENVOLVENTE_NAVE_PX, SEMIALTO_MAXIMO_NAVE_PX } from "@/sim/naves/geometriaCasco";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

// Distancia mínima entre centros de dos naves tras moverse: dos radios
// envolventes, así que ningún par de siluetas puede solaparse. Es una cota
// conservadora (más estricta que comparar polígonos) y barata.
export const SEPARACION_MINIMA_CASCOS_U = 2 * RADIO_ENVOLVENTE_NAVE_PX;

export interface PuntoNave {
  readonly x: number;
  readonly y: number;
}

export interface LimitesNave {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

// Rectángulo por el que puede moverse el centro de una nave. Lo comparten
// esPosicionValida y el empuje dirigido, que necesita saber CONTRA QUÉ borde
// topa para deslizar por él en vez de pararse.
export function limitesNave(mundo: ParametrosMundo): LimitesNave {
  return {
    xMin: MARGEN_MUNDO_NAVE_PX,
    xMax: mundo.ancho - MARGEN_MUNDO_NAVE_PX,
    yMin: MARGEN_MUNDO_NAVE_PX,
    yMax: mundo.alto - Math.max(MARGEN_MUNDO_NAVE_PX, franjaInferiorU(mundo.alto) + SEMIALTO_MAXIMO_NAVE_PX),
  };
}

export function chocaConOtraNave(punto: PuntoNave, otras: readonly PuntoNave[]): boolean {
  return otras.some((otra) => Math.hypot(otra.x - punto.x, otra.y - punto.y) < SEPARACION_MINIMA_CASCOS_U);
}

// Predicado único de «posición válida para una nave»: dentro del margen del
// mundo, fuera de la franja inferior que tapa la consola, sin sólidos cerca y
// lejos de los demás cascos. Vive aparte para que lo compartan el
// desplazamiento tras impacto y, más adelante, los propulsores o el terremoto
// sin que cada uno reimplemente (y desincronice) estas reglas.
export function esPosicionValida(
  punto: PuntoNave,
  mundo: ParametrosMundo,
  mascara: Mascara,
  otras: readonly PuntoNave[],
): boolean {
  const { xMin, xMax, yMin, yMax } = limitesNave(mundo);
  if (punto.x < xMin || punto.x > xMax) return false;
  if (punto.y < yMin || punto.y > yMax) return false;
  if (chocaConOtraNave(punto, otras)) return false;
  return libreDeSolido(mascara, punto.x, punto.y, HOLGURA_SOLIDO_NAVE_PX);
}
