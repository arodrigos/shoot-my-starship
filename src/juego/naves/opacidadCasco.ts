import { puntosCascoVariante, type VarianteNave } from "@/sim/naves/geometriaCasco";
import { dentroDelPoligono } from "@/sim/naves/contacto";

// naves-silueta: la silueta dibujada ES la zona de impacto, así que ya no hay
// un "núcleo" más opaco que el resto: dentro del polígono se pinta opaco y
// fuera no se pinta nada.
export const OPACIDAD_CASCO = 1.0;

// Opacidad con la que se dibujaría el punto (x, y), en coordenadas locales del
// contenedor de la nave.
export function opacidadEnPunto(x: number, y: number, dir: 1 | -1, variante: VarianteNave = 0): number {
  return dentroDelPoligono(x, y, puntosCascoVariante(variante, dir)) ? OPACIDAD_CASCO : 0;
}
