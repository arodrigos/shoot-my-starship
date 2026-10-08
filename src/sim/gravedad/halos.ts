import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { Planeta } from "@/sim/gravedad/planetas";

export const ANILLOS_MAXIMOS = 4;

// Opacidad por nivel, de dentro afuera. Es una tabla fija y no una función de
// la aceleración para que la opacidad decrezca estrictamente con el radio
// aunque el pozo sea débil o esté recortado por el mundo.
export const OPACIDAD_ANILLO: readonly number[] = [0.34, 0.22, 0.13, 0.07];

export interface AnilloHalo {
  readonly nivel: number;
  readonly r: number;
  // Aceleración objetivo del nivel: a_sup × 2^-(nivel+1).
  readonly aceleracion: number;
  readonly opacidad: number;
}

const ITERACIONES_BISECCION = 40;

// Aceleración del pozo SOLO (sin el resto de planetas) a distancia r hacia +x.
// Es la misma función que integra el vuelo, evaluada con un registro de uno:
// así los halos no dependen de qué otros pozos haya en esa dirección.
export function aceleracionPozo(pozo: Planeta, r: number): number {
  const a = calcularAceleracionGravitatoria([pozo], pozo.cx + r, pozo.cy);
  return Math.hypot(a.x, a.y);
}

// Radios de acción de un pozo. `masaReferencia` es la masa con la que el pozo
// nació (multiplicador 1, planeta entero): a_sup se mide con ella y NO con la
// masa viva, porque si no los anillos serían los mismos para cualquier masa y
// no crecerían con «Gravedad ×2» ni menguarían con un cráter. Un nivel cuya
// aceleración no se alcanza ni en la superficie (pozo muy debilitado) no se
// dibuja; uno que cae fuera de la diagonal del mundo, tampoco.
export function radiosHalo(pozo: Planeta, masaReferencia: number, ancho: number, alto: number): AnilloHalo[] {
  const diagonal = Math.hypot(ancho, alto);
  const referencia: Planeta = { ...pozo, masaFija: masaReferencia };
  const aSup = aceleracionPozo(referencia, pozo.radio);
  const anillos: AnilloHalo[] = [];
  for (let nivel = 0; nivel < ANILLOS_MAXIMOS; nivel++) {
    const objetivo = aSup * 2 ** -(nivel + 1);
    // Con el suavizado de Aarseth la aceleración baja de forma monótona a
    // partir de radio/√2, así que desde la superficie la bisección es válida.
    if (aceleracionPozo(pozo, pozo.radio) < objetivo) continue;
    if (aceleracionPozo(pozo, diagonal) >= objetivo) continue;
    let cerca = pozo.radio;
    let lejos = diagonal;
    for (let i = 0; i < ITERACIONES_BISECCION; i++) {
      const medio = (cerca + lejos) / 2;
      if (aceleracionPozo(pozo, medio) >= objetivo) cerca = medio;
      else lejos = medio;
    }
    anillos.push({ nivel, r: (cerca + lejos) / 2, aceleracion: objetivo, opacidad: OPACIDAD_ANILLO[nivel] });
  }
  return anillos;
}
