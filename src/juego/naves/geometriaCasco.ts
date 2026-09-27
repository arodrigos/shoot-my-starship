// Geometría pura del casco (sin Phaser): impacto-naves (imp-6) exige que
// RADIO_CASCO_NAVE_PX se corresponda con lo que de verdad se dibuja, medido
// desde la propia función de geometría -- nunca desde una constante copiada
// a mano en un test. Separado de Nave.ts (que sí importa Phaser) para que
// tests/unit/impacto/imp-6.test.ts pueda medir esta silueta en Node, sin
// canvas ni DOM.
export const ANCHO_CASCO = 46;
// Centrada en el origen del contenedor (el mismo (x, y) que usa la física
// para el círculo de colisión, RADIO_CASCO_NAVE_PX) -- de -ALTO_CASCO/2 a
// +ALTO_CASCO/2, no de 0 hacia arriba como antes de este bloque (cuando el
// origen era la base/patas de la nave, no su centro).
export const ALTO_CASCO = 44;
export const LARGO_CANON = 30;

export interface PuntoCasco {
  readonly x: number;
  readonly y: number;
}

// Silueta poligonal (fuselaje + aleta de cola), en coordenadas locales del
// contenedor. `dir` es +1 (mira hacia +x) o -1 (mira hacia -x).
export function puntosCasco(dir: 1 | -1): readonly PuntoCasco[] {
  return [
    { x: -0.5 * ANCHO_CASCO * dir, y: 0.32 * ALTO_CASCO },
    { x: -0.35 * ANCHO_CASCO * dir, y: -0.5 * ALTO_CASCO },
    { x: 0.3 * ANCHO_CASCO * dir, y: -0.36 * ALTO_CASCO },
    { x: 0.55 * ANCHO_CASCO * dir, y: -0.11 * ALTO_CASCO },
    { x: 0.2 * ANCHO_CASCO * dir, y: 0.5 * ALTO_CASCO },
  ];
}

// Caja delimitadora real de la silueta dibujada -- lo que imp-6 compara
// contra RADIO_CASCO_NAVE_PX.
export function cajaCasco(dir: 1 | -1): { readonly ancho: number; readonly alto: number } {
  const puntos = puntosCasco(dir);
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  return {
    ancho: Math.max(...xs) - Math.min(...xs),
    alto: Math.max(...ys) - Math.min(...ys),
  };
}
