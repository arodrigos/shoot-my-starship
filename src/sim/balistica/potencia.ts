// Conversión potencia (0-100, lo que expone el control) <-> velocidad
// (px/s, lo que integra la física). Vive aparte porque avanzar() y el
// solucionador balístico (armas-7) necesitan las dos direcciones de la
// misma conversión, y antes de este bloque solo existía una mitad, privada
// dentro de avanzar.ts.
export const POTENCIA_MINIMA_PX_S = 300;
export const POTENCIA_MAXIMA_PX_S = 1400;

export function velocidadDesdePotencia(potencia: number): number {
  const p = Math.min(100, Math.max(0, potencia)) / 100;
  return POTENCIA_MINIMA_PX_S + p * (POTENCIA_MAXIMA_PX_S - POTENCIA_MINIMA_PX_S);
}

export function potenciaDesdeVelocidad(velocidad: number): number {
  const rango = POTENCIA_MAXIMA_PX_S - POTENCIA_MINIMA_PX_S;
  return (100 * (velocidad - POTENCIA_MINIMA_PX_S)) / rango;
}
