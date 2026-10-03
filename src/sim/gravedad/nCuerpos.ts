import { masaPlaneta, type RegistroPlanetas } from "@/sim/gravedad/planetas";

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

// Constante gravitacional DEL JUEGO, no la física real (6,67e-11 no serviría
// a escala de píxeles). gravedad-calibracion (punto 6 del brief) sube este
// valor de 6 a 1200: con 6, un disparo que pasa a 1,5 radios de un planeta
// típico de generador-sistema se desviaba menos de 2px en 2 pozos sobre 30
// escenarios sembrados (ver gravedad-calibracion-1) -- la gravedad se
// aplicaba de verdad pero por debajo de cualquier umbral perceptible, así
// que elegir potencia alta era, a efectos prácticos, la forma de que no
// importara. 1200 es el valor más pequeño que deja ≥90% de esos escenarios
// por encima de 3 radios de casco (66px) sin subir la tasa de "perdido" por
// captura orbital (medida en gravedad-calibracion-3): a partir de ~300x el
// valor original la relación de desviación potencia-mínima/potencia-máxima
// empieza a degradarse (la aproximación de ángulo pequeño deja de valer) y
// alrededor de 1200x es donde ambos objetivos (gravedad-calibracion-1 y -2)
// caben a la vez con margen. grav-1 y grav-6 fijan sus propios números
// contra este valor; grav-6 en concreto fija la velocidad orbital teórica
// (v = sqrt(G*M*d²/(d²+eps²)^1.5)) que cambia con G.
export const CONSTANTE_GRAVITACIONAL = 1200;

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
