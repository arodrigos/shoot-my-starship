import { octavoDelMundo } from "@/sim/naves/desplazamiento";
import { esPosicionValida, limitesNave, type PuntoNave } from "@/sim/naves/zonaValida";
import type { EstadoNave } from "@/sim/partida/tipos";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

// Paso radial de la búsqueda y arco entre candidatos de un mismo anillo: el
// anillo más cercano con algún punto válido fija la distancia mínima (± paso).
export const PASO_ANILLO_U = 2;
const ARCO_CANDIDATOS_U = 6;
// Paso de la rejilla de último recurso, cuando ni el entorno cercano tiene sitio.
const PASO_REJILLA_U = 8;

export interface NaveAsentada {
  readonly nave: number;
  readonly desde: PuntoNave;
  readonly hasta: PuntoNave;
}

export interface ResultadoAsentamiento {
  readonly naves: readonly EstadoNave[];
  readonly asentadas: readonly NaveAsentada[];
  // Naves a las que no se les encontró sitio en todo el mundo: quedan
  // destruidas antes que dentro de un sólido.
  readonly destruidas: readonly number[];
}

function otrasVivas(naves: readonly EstadoNave[], id: number): PuntoNave[] {
  return naves.flatMap((otra, idOtra) => (idOtra !== id && otra.integridad > 0 && otra.y !== undefined ? [{ x: otra.x, y: otra.y }] : []));
}

// Posición válida más cercana: anillos de 2 u hasta medio octavo del mundo y,
// si no hay nada, rejilla gruesa sobre todo el mundo (la más cercana de ella).
export function buscarPosicionValida(desde: PuntoNave, mundo: ParametrosMundo, mascara: Mascara, otras: readonly PuntoNave[]): PuntoNave | null {
  const alcance = 0.5 * octavoDelMundo(mundo);
  for (let radio = PASO_ANILLO_U; radio <= alcance; radio += PASO_ANILLO_U) {
    const pasos = Math.max(8, Math.ceil((2 * Math.PI * radio) / ARCO_CANDIDATOS_U));
    let mejor: PuntoNave | null = null;
    let mejorDistancia = Infinity;
    for (let i = 0; i < pasos; i++) {
      const angulo = (2 * Math.PI * i) / pasos;
      const punto = { x: desde.x + radio * Math.cos(angulo), y: desde.y + radio * Math.sin(angulo) };
      if (!esPosicionValida(punto, mundo, mascara, otras)) continue;
      const distancia = Math.hypot(punto.x - desde.x, punto.y - desde.y);
      if (distancia < mejorDistancia) {
        mejor = punto;
        mejorDistancia = distancia;
      }
    }
    if (mejor !== null) return mejor;
  }
  const { xMin, xMax, yMin, yMax } = limitesNave(mundo);
  let mejor: PuntoNave | null = null;
  let mejorDistancia = Infinity;
  for (let y = yMin; y <= yMax; y += PASO_REJILLA_U) {
    for (let x = xMin; x <= xMax; x += PASO_REJILLA_U) {
      const distancia = Math.hypot(x - desde.x, y - desde.y);
      if (distancia >= mejorDistancia || !esPosicionValida({ x, y }, mundo, mascara, otras)) continue;
      mejor = { x, y };
      mejorDistancia = distancia;
    }
  }
  return mejor;
}

// Garantía de «ninguna nave dentro de un planeta»: se aplica al cerrar cada
// turno sobre el estado final, venga el problema del empuje, de los
// propulsores, de un relleno de terreno o de un evento. Si todo está bien no
// toca nada (misma referencia de naves). Determinista y sin azar; las naves se
// tratan por id y cada una ve ya las posiciones asentadas de las anteriores.
export function asentarNaves(naves: readonly EstadoNave[], mundo: ParametrosMundo, mascara: Mascara): ResultadoAsentamiento {
  const resultado = [...naves];
  const asentadas: NaveAsentada[] = [];
  const destruidas: number[] = [];
  naves.forEach((nave, id) => {
    if (nave.integridad <= 0 || nave.y === undefined) return;
    const actual = { x: nave.x, y: nave.y };
    if (esPosicionValida(actual, mundo, mascara, otrasVivas(resultado, id))) return;
    const destino = buscarPosicionValida(actual, mundo, mascara, otrasVivas(resultado, id));
    if (destino === null) {
      resultado[id] = { ...nave, integridad: 0 };
      destruidas.push(id);
      return;
    }
    resultado[id] = { ...nave, x: destino.x, y: destino.y };
    asentadas.push({ nave: id, desde: actual, hasta: destino });
  });
  return asentadas.length === 0 && destruidas.length === 0 ? { naves, asentadas, destruidas } : { naves: resultado, asentadas, destruidas };
}
