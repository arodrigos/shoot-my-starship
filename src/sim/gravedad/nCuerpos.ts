import { masaPlaneta, type RegistroPlanetas } from "@/sim/gravedad/planetas";

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

// Constante gravitacional DEL JUEGO, no la física real (6,67e-11 no serviría
// a escala de píxeles): se elige el valor más pequeño que basta para que,
// con las masas y distancias que va a producir generador-sistema (densidad
// ~1, planetas de decenas a un par de cientos de píxeles de radio, mundos de
// varios miles de píxeles), la curvatura sea perceptible en segundos de
// vuelo y no en minutos. grav-1 fija el propio valor contra un resultado
// observable (cuánto se desvía un disparo de referencia), así que cambiarlo
// aquí sin tocar ese test es autocorrectivo: seguiría siendo "el punto donde
// se ve la curva", solo que con otro número.
export const CONSTANTE_GRAVITACIONAL = 6;

// Suma de N cuerpos con suavizado de Aarseth (1963): potencial
// 1/sqrt(r² + eps²) en vez de 1/r, con eps = radio del planeta. Sin él, la
// fuerza diverge cuando el proyectil pasa por el centro exacto de un planeta
// (grav-2) -- y dentro del radio del planeta la ley de la inversa del
// cuadrado ya no describe nada real de todas formas, porque para entonces el
// proyectil habría chocado con la máscara.
export function calcularAceleracionGravitatoria(planetas: RegistroPlanetas, x: number, y: number): Vector2 {
  let ax = 0;
  let ay = 0;

  for (const planeta of planetas) {
    const dx = planeta.cx - x;
    const dy = planeta.cy - y;
    const eps = planeta.radio;
    const distanciaCuadradoSuavizada = dx * dx + dy * dy + eps * eps;
    const factor = (CONSTANTE_GRAVITACIONAL * masaPlaneta(planeta)) / (distanciaCuadradoSuavizada * Math.sqrt(distanciaCuadradoSuavizada));
    ax += factor * dx;
    ay += factor * dy;
  }

  return { x: ax, y: ay };
}
