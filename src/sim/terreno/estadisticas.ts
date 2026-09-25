import { SOLIDO, type Mascara } from "@/sim/terreno/mascara";

// humor-sistemico (Mérito Geológico): cuánto mundo ha desaparecido de verdad
// entre dos máscaras, no cuánto ha cambiado -- el Vertedero Portátil AÑADE
// sólido ("sumar"), así que solo cuentan las celdas que eran SOLIDO y han
// dejado de serlo, nunca al revés.
export function contarPixelesDestruidos(antes: Mascara, despues: Mascara): number {
  let total = 0;
  for (let i = 0; i < antes.datos.length; i++) {
    if (antes.datos[i] === SOLIDO && despues.datos[i] !== SOLIDO) {
      total++;
    }
  }
  return total;
}
