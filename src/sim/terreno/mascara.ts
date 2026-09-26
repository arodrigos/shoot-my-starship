// La máscara es la ÚNICA fuente de verdad de la colisión del terreno: un
// array tipado de un byte por píxel, sin geometría derivada (polígonos,
// contornos...). Todo lo demás -- la textura visible, la colisión de un
// proyectil, el soporte de una nave -- se calcula a partir de esto, nunca
// al revés. Es la decisión de diseño del bloque terreno-mascara.
//
// nucleo-gravedad reetiqueta el byte como id de MATERIAL en vez de un simple
// booleano: 0 aire, 1..6 el planeta que ocupa ese píxel, 255 escombro
// (anillos y asteroides del bloque generador-sistema). SOLIDO=1 se conserva
// como el id del "planeta 1" y como material genérico del terreno de tierra
// que ya existía antes de este refinamiento -- terreno-1 tiene un hash
// congelado sobre él y terreno-2 lo da por hecho, así que cambiar su valor
// rompería los dos sin que ninguno se haya tocado.
export const AIRE = 0;
export const SOLIDO = 1;
export const ESCOMBRO = 255;
export const PLANETA_MIN = 1;
export const PLANETA_MAX = 6;

export function esMaterialPlaneta(material: number): boolean {
  return material >= PLANETA_MIN && material <= PLANETA_MAX;
}

export interface Mascara {
  readonly ancho: number;
  readonly alto: number;
  readonly datos: Uint8Array;
}

export function crearMascaraVacia(ancho: number, alto: number): Mascara {
  return { ancho, alto, datos: new Uint8Array(ancho * alto) };
}

// Fuera del mapa se considera aire, en cualquier dirección: por los lados y
// por arriba porque un proyectil vuela libre ahí, y por abajo a propósito,
// porque es lo que convierte "caer por el borde inferior del mapa" en un
// estado detectable (ver resolverCaida) en vez de chocar con un suelo
// invisible que nadie declaró.
//
// "Sólido" pasa de "=== SOLIDO" a "!== AIRE" (grav-8): un escombro o
// cualquier planeta también colisionan. Mismo coste por píxel, cero memoria
// extra, y el contrato de fuera-de-límites no cambia.
export function esSolido(mascara: Mascara, x: number, y: number): boolean {
  if (x < 0 || x >= mascara.ancho || y < 0 || y >= mascara.alto) {
    return false;
  }
  return mascara.datos[y * mascara.ancho + x] !== AIRE;
}

// El byte crudo, para quien necesite saber DE QUIÉN es un píxel sólido (a
// qué planeta pertenece, o si es escombro) y no solo si colisiona. Fuera de
// límites devuelve AIRE, coherente con esSolido.
export function obtenerMaterial(mascara: Mascara, x: number, y: number): number {
  if (x < 0 || x >= mascara.ancho || y < 0 || y >= mascara.alto) {
    return AIRE;
  }
  return mascara.datos[y * mascara.ancho + x];
}
