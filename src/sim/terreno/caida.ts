import { esSolido, type Mascara } from "@/sim/terreno/mascara";

export type ResultadoCaida =
  | { readonly tipo: "reposo"; readonly y: number }
  | { readonly tipo: "eliminada" };

// Una nave se apoya en el primer píxel sólido de su columna, sin importar
// dónde estuviera antes: es lo que evita distinguir con lógica aparte entre
// "se ha quedado flotando" (una explosión le vació el suelo) y "ha quedado
// hundida" (un arma de relleno subió el terreno bajo ella) -- las dos son
// la misma pregunta, "¿cuál es el primer sólido de esta columna?". Si no
// hay ninguno en toda la columna, el mapa no tiene fondo ahí: es una caída
// al vacío por el borde inferior, y la partida la resuelve como eliminación
// en vez de como un estado imposible.
export function resolverCaida(mascara: Mascara, x: number): ResultadoCaida {
  const columna = Math.round(x);
  for (let y = 0; y < mascara.alto; y++) {
    if (esSolido(mascara, columna, y)) {
      return { tipo: "reposo", y: y - 1 };
    }
  }
  return { tipo: "eliminada" };
}
