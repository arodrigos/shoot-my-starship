// Matemática pura del apuntado indirecto (control-apuntado): sin DOM, sin
// Phaser, sin React -- por eso es lo único de este bloque que se comprueba
// con un test de Node en vez de con Playwright. La unidad de arrastre es la
// fracción de viewport (0..1), la misma convención que ya usa el resto de
// la cáscara (ver Partida.ts) para que el gesto sea invariante al tamaño de
// pantalla.
// adrian-angulo-360: el límite de 2°-178° (medio círculo, siempre hacia
// arriba) impedía disparar contra un rival que quedara por debajo del
// tirador -- una colocación real y no patológica en el hito espacial, donde
// las naves flotan en vacío y no hay "suelo" que garantice que el rival
// esté siempre por encima. El rango ahora cubre el círculo completo, con un
// solo gesto, tal como pidió Adrián.
export const ANGULO_MINIMO_GRADOS = 0;
export const ANGULO_MAXIMO_GRADOS = 360;
export const POTENCIA_MINIMA = 0;
export const POTENCIA_MAXIMA = 100;

export const ANGULO_INICIAL_GRADOS = 45;
export const POTENCIA_INICIAL = 50;

export const PASO_FINO_ANGULO_GRADOS = 0.1;
export const PASO_FINO_POTENCIA = 1;

// Ganancia < "1:1": una fracción entera de viewport arrastrada (por ejemplo,
// media pantalla) no satura de golpe el eje -- es lo que permite ajustar
// fino sin que el dedo tenga que ocupar la posición exacta del objetivo. El
// retículo y la previsualización viven en un widget de posición fija (ver
// ControlHUD), así que la ganancia gobierna solo la velocidad del ajuste,
// nunca la distancia entre el dedo y lo que se ve en pantalla.
//
// DEUDA DECLARADA (control-angulo-potencia, ver desviaciones del bloque):
// este arrastre combinado (un solo gesto sobre TODA la consola mueve ángulo
// Y potencia a la vez) es el mecanismo que Adrián pidió sustituir, y en
// ControlHUD ya no es la superficie principal de apuntado -- los dos
// controles nuevos (más abajo) son independientes de verdad. Se conserva
// como gesto de respaldo, todavía activo fuera del área de los dos
// controles nuevos, porque más de una decena de e2e ajenos a este bloque
// (esp-1, esp-2, imp-11, imp-12, cie-1, pyl-3, proy-5, nve-3, humor-5,
// humor-6, modo-1) lo usan solo como MEDIO para apuntar y disparar en un
// turno, no como objeto de la prueba -- reescribirlos todos era un cambio de
// alcance muy superior al de este bloque. Candidato a retirarse en un bloque
// de migración de tests aparte.
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

export function potenciaConPasoFino(potenciaActual: number, sentido: 1 | -1): number {
  const bruto = potenciaActual + sentido * PASO_FINO_POTENCIA;
  return clampPotencia(Math.round(bruto));
}

// control-angulo-potencia: los dos controles nuevos son independientes
// porque cada uno vive en su propio elemento del DOM (ver ControlHUD) y
// traduce el gesto con una función que solo conoce SU eje -- a diferencia
// del arrastre combinado de arriba, aquí no hay ganancia ni estado de
// inicio: la posición del dedo DENTRO del propio control (0 en el extremo
// izquierdo, 1 en el derecho) se mapea directamente a todo el rango del
// eje, así que recorrer el control de un extremo físico al otro en un solo
// gesto cubre el rango entero -- es lo que permite el giro de 180° (ctl-2)
// sin arrastrar dos veces ni tocar el otro control, que ni siquiera está en
// el mismo elemento.
export function anguloDesdeFraccionControl(fraccionHorizontal: number): number {
  const t = Math.max(0, Math.min(1, fraccionHorizontal));
  return clampAngulo(ANGULO_MINIMO_GRADOS + t * (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS));
}

export function potenciaDesdeFraccionControl(fraccionHorizontal: number): number {
  const t = Math.max(0, Math.min(1, fraccionHorizontal));
  return clampPotencia(POTENCIA_MINIMA + t * (POTENCIA_MAXIMA - POTENCIA_MINIMA));
}

// apuntado-y-relevo: apuntado directo sobre el lienzo, al estilo de arrastrar
// la goma de un tirachinas: el ángulo es la dirección nave→dedo y la
// potencia, la distancia entre ambos. Es lo que da precisión en el móvil: a
// 120 px de la nave un píxel de dedo son ~0,5°, frente a los ~1,2° por
// píxel de la barra horizontal. Trabaja en píxeles CSS de pantalla (y hacia
// abajo), no en unidades de mundo, para que el gesto se sienta igual con
// cualquier escala de mundo.
//
// Dentro de este radio la dirección nave→dedo es ruido (el dedo tapa la nave):
// se ignora el gesto en vez de girar el ángulo a saltos.
export const ZONA_MUERTA_APUNTADO_PX = 8;
// Fracción del lado menor del viewport a la que la potencia llega a 100.
export const FRACCION_LADO_MENOR_POTENCIA_MAXIMA = 0.4;

export interface PuntoPantalla {
  readonly x: number;
  readonly y: number;
}

// null dentro de la zona muerta: quien llama conserva el ángulo anterior.
export function anguloDesdeDedo(nave: PuntoPantalla, dedo: PuntoPantalla): number | null {
  const dx = dedo.x - nave.x;
  // La y de pantalla crece hacia abajo; el ángulo del juego crece hacia
  // arriba (90° = arriba), de ahí la inversión.
  const dy = nave.y - dedo.y;
  if (Math.hypot(dx, dy) <= ZONA_MUERTA_APUNTADO_PX) return null;
  const grados = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalizado = grados < 0 ? grados + 360 : grados;
  // atan2 de un valor negativo diminuto puede sumar 360 y dejar exactamente
  // 360: es el mismo ángulo que 0, y el rango publicado es [0, 360).
  return normalizado >= 360 ? 0 : normalizado;
}

export function potenciaDesdeDistancia(distanciaPx: number, ladoMenorViewportPx: number): number {
  if (!(ladoMenorViewportPx > 0) || !Number.isFinite(distanciaPx)) return POTENCIA_MINIMA;
  const fraccion = distanciaPx / (FRACCION_LADO_MENOR_POTENCIA_MAXIMA * ladoMenorViewportPx);
  return clampPotencia(POTENCIA_MINIMA + fraccion * (POTENCIA_MAXIMA - POTENCIA_MINIMA));
}

// ctl-6: saneado del ajuste persistido en localStorage -- un valor corrupto
// (NaN, fuera de rango, tipo equivocado) nunca debe romper el arranque; se
// satura a rango si es un número válido, o cae al valor por defecto si no
// lo es. Solo conoce ángulo y potencia (el arma se valida aparte, contra el
// catálogo, en el store que sí lo conoce).
export interface AjusteNumericoGuardado {
  readonly anguloGrados: number;
  readonly potencia: number;
}

export function sanearAjusteNumericoGuardado(valor: unknown): AjusteNumericoGuardado | null {
  if (typeof valor !== "object" || valor === null) return null;
  const v = valor as Record<string, unknown>;
  if (typeof v.anguloGrados !== "number" || !Number.isFinite(v.anguloGrados)) return null;
  if (typeof v.potencia !== "number" || !Number.isFinite(v.potencia)) return null;
  return { anguloGrados: clampAngulo(v.anguloGrados), potencia: clampPotencia(v.potencia) };
}
