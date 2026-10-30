import { AIRE, type Mascara } from "@/sim/terreno/mascara";

// humor-sistemico (Mérito Geológico): cuánto mundo ha desaparecido de verdad
// entre dos máscaras, no cuánto ha cambiado -- el Vertedero Portátil AÑADE
// sólido ("sumar"), así que solo cuentan las celdas que tenían material y
// han quedado en aire, nunca al revés ni un material tapado por otro.
//
// "Material" es cualquier byte distinto de AIRE desde grav-8: los planetas
// 1..12 y también el escombro. El escombro se excluye de la masa (sis-4)
// porque no atrae, no porque no sea mundo: colisiona como cualquier sólido
// (esSolido), se pinta en el lienzo y la misma huella "restar" lo vacía.
export function contarPixelesDestruidos(antes: Mascara, despues: Mascara): number {
  let total = 0;
  for (let i = 0; i < antes.datos.length; i++) {
    if (antes.datos[i] !== AIRE && despues.datos[i] === AIRE) {
      total++;
    }
  }
  return total;
}
