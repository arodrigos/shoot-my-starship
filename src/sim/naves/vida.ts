// Única fuente de la vida máxima de una nave: colocación, motor, objetos del
// universo, IA y HUD la leen de aquí. Con valores escritos a mano en cada
// sitio, subirla de 100 a 150 dejaba rincones topando en 100.
export const INTEGRIDAD_MAXIMA = 150;

// Acota al rango válido de una nave.
export function acotarIntegridad(integridad: number): number {
  return Math.min(INTEGRIDAD_MAXIMA, Math.max(0, integridad));
}

// Fracción 0-100 de la vida máxima: lo que dibujan la barra y el casco.
export function porcentajeIntegridad(integridad: number): number {
  return (100 * acotarIntegridad(integridad)) / INTEGRIDAD_MAXIMA;
}
