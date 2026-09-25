import { crearMascaraVacia, SOLIDO, type Mascara } from "@/sim/terreno/mascara";

// Suelo plano de pared a pared desde alturaSuelo hasta el fondo: lo que
// necesitan los tests que fijan a mano ángulo y potencia para que el disparo
// aterrice cerca de un punto concreto -- con terreno generado por ruido, esa
// cuenta ya no se puede hacer a mano.
export function crearMascaraPlana(ancho: number, alto: number, alturaSuelo: number): Mascara {
  const mascara = crearMascaraVacia(ancho, alto);
  for (let y = alturaSuelo; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      mascara.datos[y * ancho + x] = SOLIDO;
    }
  }
  return mascara;
}
