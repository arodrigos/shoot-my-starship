// Matemática pura del apuntado indirecto (control-apuntado): sin DOM, sin
// Phaser, sin React -- por eso es lo único de este bloque que se comprueba
// con un test de Node en vez de con Playwright. La unidad de arrastre es la
// fracción de viewport (0..1), la misma convención que ya usa el resto de
// la cáscara (ver Partida.ts) para que el gesto sea invariante al tamaño de
// pantalla.
export const ANGULO_MINIMO_GRADOS = 2;
export const ANGULO_MAXIMO_GRADOS = 178;
export const POTENCIA_MINIMA = 0;
export const POTENCIA_MAXIMA = 100;

export const ANGULO_INICIAL_GRADOS = 45;
export const POTENCIA_INICIAL = 50;

export const PASO_FINO_ANGULO_GRADOS = 0.1;

// Ganancia < "1:1": una fracción entera de viewport arrastrada (por ejemplo,
// media pantalla) no satura de golpe el eje -- es lo que permite ajustar
// fino sin que el dedo tenga que ocupar la posición exacta del objetivo. El
// retículo y la previsualización viven en un widget de posición fija (ver
// ControlHUD), así que la ganancia gobierna solo la velocidad del ajuste,
// nunca la distancia entre el dedo y lo que se ve en pantalla.
export const GANANCIA_ANGULO_GRADOS = 120;
export const GANANCIA_POTENCIA = 150;

export interface FraccionDeVentana {
  readonly x: number;
  readonly y: number;
}

export function clampAngulo(grados: number): number {
  return Math.max(ANGULO_MINIMO_GRADOS, Math.min(ANGULO_MAXIMO_GRADOS, grados));
}

export function clampPotencia(valor: number): number {
  return Math.max(POTENCIA_MINIMA, Math.min(POTENCIA_MAXIMA, valor));
}

// El ángulo sube al arrastrar hacia arriba de la pantalla (fracción y
// decreciente): de ahí el signo negativo, la misma convención de "arriba es
// más vertical" que ya usaba el tirachinas que este bloque sustituye.
export function anguloTrasArrastre(
  anguloInicioGrados: number,
  inicio: FraccionDeVentana,
  actual: FraccionDeVentana,
): number {
  const deltaVertical = -(actual.y - inicio.y);
  return clampAngulo(anguloInicioGrados + deltaVertical * GANANCIA_ANGULO_GRADOS);
}

export function potenciaTrasArrastre(
  potenciaInicio: number,
  inicio: FraccionDeVentana,
  actual: FraccionDeVentana,
): number {
  const deltaHorizontal = actual.x - inicio.x;
  return clampPotencia(potenciaInicio + deltaHorizontal * GANANCIA_POTENCIA);
}

// Redondear a una décima en cada paso (en vez de solo sumar) es lo que evita
// que el error de coma flotante de sumar 0.1 diez veces seguidas deje el
// ángulo en 45.99999999999999 en vez de 46 exactos (control-2).
export function anguloConPasoFino(anguloActualGrados: number, sentido: 1 | -1): number {
  const bruto = anguloActualGrados + sentido * PASO_FINO_ANGULO_GRADOS;
  const redondeado = Math.round(bruto * 10) / 10;
  return clampAngulo(redondeado);
}
