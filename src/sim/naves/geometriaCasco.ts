// Geometría COMPARTIDA del casco (sin Phaser): baja a src/sim en
// escala-legible porque contacto-honesto (el bloque siguiente) necesita
// clasificar el roce en el núcleo con datos deterministas, no con una
// interpretación del cliente -- src/juego la lee, nunca al revés
// (comprobar-frontera-nucleo.mjs).
//
// Opción B de Adrián (puerta de aprobación de diseño, iteración 1): la nave
// se dibuja grande para que se lea a 360px de ancho, pero el casco de
// COLISIÓN (RADIO_CASCO_NAVE_PX, en src/sim/naves/impacto.ts) se queda
// exactamente en 22px y no se toca. ESCALA_DIBUJO_NAVE es la única palanca:
// multiplica la silueta base (46x44, la misma de siempre) sin tocar ni un
// píxel de lo que de verdad colisiona.
export const ESCALA_DIBUJO_NAVE = 3.0;

const ANCHO_CASCO_BASE = 46;
const ALTO_CASCO_BASE = 44;
const LARGO_CANON_BASE = 30;

export const ANCHO_CASCO = ANCHO_CASCO_BASE * ESCALA_DIBUJO_NAVE;
// Centrada en el origen del contenedor (el mismo (x, y) que usa la física
// para el círculo de colisión, RADIO_CASCO_NAVE_PX) -- de -ALTO_CASCO/2 a
// +ALTO_CASCO/2.
export const ALTO_CASCO = ALTO_CASCO_BASE * ESCALA_DIBUJO_NAVE;
export const LARGO_CANON = LARGO_CANON_BASE * ESCALA_DIBUJO_NAVE;

export interface PuntoCasco {
  readonly x: number;
  readonly y: number;
}

// Silueta poligonal (fuselaje + aleta de cola), en coordenadas locales del
// contenedor y YA a escala de dibujo. `dir` es +1 (mira hacia +x) o -1
// (mira hacia -x). Es la silueta de la variante 0 -- se mantiene como
// función propia (en vez de un alias de puntosCascoVariante(0, dir)) porque
// es la firma que ya usan contacto.ts, opacidadCasco.ts y los tests de
// escala-legible/contacto-honesto desde antes de que existieran las otras
// tres variantes.
export function puntosCasco(dir: 1 | -1): readonly PuntoCasco[] {
  return [
    { x: -0.5 * ANCHO_CASCO * dir, y: 0.32 * ALTO_CASCO },
    { x: -0.35 * ANCHO_CASCO * dir, y: -0.5 * ALTO_CASCO },
    { x: 0.3 * ANCHO_CASCO * dir, y: -0.36 * ALTO_CASCO },
    { x: 0.55 * ANCHO_CASCO * dir, y: -0.11 * ALTO_CASCO },
    { x: 0.2 * ANCHO_CASCO * dir, y: 0.5 * ALTO_CASCO },
  ];
}

export type VarianteNave = 0 | 1 | 2 | 3;

// arte-siluetas-3: cuatro siluetas de CASCO distintas por forma (no solo
// mirroring por dirección), listas para cuando nucleo-n-naves deje de ser
// 0 | 1. Las cuatro mantienen los mismos cinco vértices semánticos que
// puntosCasco (borde-trasero-inferior, borde-trasero-superior, morro-alto,
// morro-punta, borde-delantero-inferior) para que puntosCascoConDanio siga
// insertando sus abolladuras entre los mismos pares de vértices sin
// importar la variante -- cambia la geometría, no la topología.
export function puntosCascoVariante(variante: VarianteNave, dir: 1 | -1): readonly PuntoCasco[] {
  if (variante === 0) return puntosCasco(dir);
  const factores: Record<Exclude<VarianteNave, 0>, readonly PuntoCasco[]> = {
    // Variante 1 "lanza": morro muy adelantado y agudo, cola estrecha.
    1: [
      { x: -0.3, y: 0.3 },
      { x: -0.45, y: -0.35 },
      { x: 0.1, y: -0.5 },
      { x: 0.65, y: 0 },
      { x: 0.1, y: 0.4 },
    ],
    // Variante 2 "tanque": fuselaje ancho y romo, casi rectangular.
    2: [
      { x: -0.55, y: 0.45 },
      { x: -0.55, y: -0.45 },
      { x: 0.2, y: -0.5 },
      { x: 0.5, y: 0 },
      { x: 0.2, y: 0.5 },
    ],
    // Variante 3 "insecto": asimétrica, con el morro desplazado hacia
    // abajo en vez de hacia arriba -- la silueta más distinta de las
    // cuatro vista en conjunto.
    3: [
      { x: -0.35, y: 0.5 },
      { x: -0.6, y: -0.15 },
      { x: 0.05, y: -0.55 },
      { x: 0.6, y: 0.05 },
      { x: 0.1, y: 0.35 },
    ],
  };
  return factores[variante].map((p) => ({ x: p.x * ANCHO_CASCO * dir, y: p.y * ALTO_CASCO }));
}

// Caja delimitadora real de la silueta DIBUJADA (a escala de dibujo) -- lo
// que esc-1/esc-2 usan para derivar el tamaño del proyectil, y lo que
// imp-6 compara contra RADIO_CASCO_NAVE_PX (una proporción deliberadamente
// distinta desde escala-legible, ver el comentario en ese test).
export function cajaCasco(dir: 1 | -1): { readonly ancho: number; readonly alto: number } {
  const puntos = puntosCasco(dir);
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  return {
    ancho: Math.max(...xs) - Math.min(...xs),
    alto: Math.max(...ys) - Math.min(...ys),
  };
}
