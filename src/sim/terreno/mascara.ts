// La máscara es la ÚNICA fuente de verdad de la colisión del terreno: un
// array tipado de un byte por píxel, sin geometría derivada (polígonos,
// contornos...). Todo lo demás -- la textura visible, la colisión de un
// proyectil, el soporte de una nave -- se calcula a partir de esto, nunca
// al revés. Es la decisión de diseño del bloque terreno-mascara.
export const AIRE = 0;
export const SOLIDO = 1;

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
export function esSolido(mascara: Mascara, x: number, y: number): boolean {
  if (x < 0 || x >= mascara.ancho || y < 0 || y >= mascara.alto) {
    return false;
  }
  return mascara.datos[y * mascara.ancho + x] === SOLIDO;
}
