import { puntosCasco, type PuntoCasco } from "@/sim/naves/geometriaCasco";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

// escala-legible (esc-5): la opción B hace que el dibujo mienta sobre lo que
// de verdad colisiona, así que la jerarquía visual tiene que dejarlo claro
// por sí sola -- el núcleo (lo que golpea de verdad) se dibuja siempre
// opaco, y nada de lo que se dibuja fuera de él puede alcanzar esa misma
// opacidad, para que no se lea como blindaje donde no lo hay.
export const OPACIDAD_NUCLEO = 1.0;
export const TECHO_OPACIDAD_FUERA_NUCLEO = 0.4;

// Ray casting estándar (par/impar de cruces con los lados del polígono):
// suficiente para el polígono simple (sin autointersecciones) de
// puntosCasco, y es la misma prueba que "¿este píxel cae dentro de la
// silueta dibujada?" sin necesitar un canvas real.
function dentroDelPoligono(x: number, y: number, puntos: readonly PuntoCasco[]): boolean {
  let dentro = false;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const pi = puntos[i];
    const pj = puntos[j];
    const cruza = pi.y > y !== pj.y > y && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

// Opacidad con la que se dibujaría el punto (x, y), en coordenadas locales
// del contenedor de la nave (el mismo origen que RADIO_CASCO_NAVE_PX):
// OPACIDAD_NUCLEO dentro del casco de colisión real, TECHO_OPACIDAD_FUERA_NUCLEO
// en el resto de la silueta dibujada, y 0 fuera de toda silueta.
export function opacidadEnPunto(x: number, y: number, dir: 1 | -1): number {
  if (Math.hypot(x, y) <= RADIO_CASCO_NAVE_PX) {
    return OPACIDAD_NUCLEO;
  }
  return dentroDelPoligono(x, y, puntosCasco(dir)) ? TECHO_OPACIDAD_FUERA_NUCLEO : 0;
}
