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
// (mira hacia -x).
export function puntosCasco(dir: 1 | -1): readonly PuntoCasco[] {
  return [
    { x: -0.5 * ANCHO_CASCO * dir, y: 0.32 * ALTO_CASCO },
    { x: -0.35 * ANCHO_CASCO * dir, y: -0.5 * ALTO_CASCO },
    { x: 0.3 * ANCHO_CASCO * dir, y: -0.36 * ALTO_CASCO },
    { x: 0.55 * ANCHO_CASCO * dir, y: -0.11 * ALTO_CASCO },
    { x: 0.2 * ANCHO_CASCO * dir, y: 0.5 * ALTO_CASCO },
  ];
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
