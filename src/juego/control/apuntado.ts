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
// apuntado-y-relevo: al llegar a 0°/360° el paso fino da la vuelta (359,9° +
// 0,1° = 0,0°) en vez de quedarse pegado: el apuntado directo puede dejar el
// ángulo a un lado u otro de la costura y afinar tiene que poder cruzarla.
export function anguloConPasoFino(anguloActualGrados: number, sentido: 1 | -1): number {
  const bruto = anguloActualGrados + sentido * PASO_FINO_ANGULO_GRADOS;
  const redondeado = Math.round(bruto * 10) / 10;
  const vuelta = ((redondeado % ANGULO_MAXIMO_GRADOS) + ANGULO_MAXIMO_GRADOS) % ANGULO_MAXIMO_GRADOS;
  // Sumar 360 a un decimal vuelve a ensuciar el último bit.
  return clampAngulo(Math.round(vuelta * 10) / 10);
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

// apuntado-dedo: gesto relativo desde cualquier punto del lienzo. El dedo no
// manda la dirección por dónde está (así no tapa la nave ni la flecha): manda
// cuánto se mueve. Lo que se mueve perpendicular a la línea nave→dedo gira la
// dirección, y lo que se acerca o se aleja de la nave cambia la fuerza. Trabaja
// en píxeles CSS de pantalla (y hacia abajo), no en unidades de mundo, para que
// el gesto se sienta igual con cualquier escala de mundo.
export const GRADOS_POR_PX_GIRO = 0.25;
export const FUERZA_POR_PX_RADIAL = 0.3;
// Dentro de este radio la línea nave→dedo es ruido: el eje radial pasa a ser
// la dirección actual de la flecha, y el gesto funciona igual.
export const RADIO_CERCA_NAVE_PX = 30;
// Un toque que no llega a moverse tanto no es un gesto (el temblor del dedo al
// apoyarlo no debe mover el apuntado).
export const UMBRAL_TOQUE_PX = 4;

export interface PuntoPantalla {
  readonly x: number;
  readonly y: number;
}

// Los ejes y los valores de partida se fijan al apoyar el dedo y el movimiento
// se mide siempre contra ese origen. Recalcular los ejes en cada evento hacía
// que un barrido recto fuese «girando» la línea nave→dedo y se colase en la
// fuerza, más cuanto más eventos llegaban (un iPad a 120 Hz más que un móvil
// a 60 Hz): el resultado dependía de la frecuencia del táctil, no del gesto.
interface AnclaGesto {
  readonly ux: number;
  readonly uy: number;
  readonly anguloGrados: number;
  readonly potencia: number;
}

export interface GestoApuntado {
  readonly origen: PuntoPantalla;
  // Se rellena en la primera llamada a avanzarGesto, que es cuando se conoce
  // la nave y el apuntado vigente.
  readonly ancla: AnclaGesto | null;
  readonly iniciado: boolean;
}

export interface ResultadoGesto {
  readonly gesto: GestoApuntado;
  readonly anguloGrados: number;
  readonly potencia: number;
}

export function iniciarGesto(dedo: PuntoPantalla): GestoApuntado {
  return { origen: dedo, ancla: null, iniciado: false };
}

function anclarGesto(
  origen: PuntoPantalla,
  nave: PuntoPantalla,
  anguloGrados: number,
  potencia: number,
): AnclaGesto {
  const rx = origen.x - nave.x;
  const ry = nave.y - origen.y;
  const largo = Math.hypot(rx, ry);
  const rad = (anguloGrados * Math.PI) / 180;
  const lejos = largo >= RADIO_CERCA_NAVE_PX;
  return {
    ux: lejos ? rx / largo : Math.cos(rad),
    uy: lejos ? ry / largo : Math.sin(rad),
    anguloGrados,
    potencia,
  };
}

export function avanzarGesto(
  gesto: GestoApuntado,
  nave: PuntoPantalla,
  dedo: PuntoPantalla,
  anguloGrados: number,
  potencia: number,
): ResultadoGesto {
  const ancla = gesto.ancla ?? anclarGesto(gesto.origen, nave, anguloGrados, potencia);
  const dx = dedo.x - gesto.origen.x;
  const dy = dedo.y - gesto.origen.y;
  if (!gesto.iniciado && Math.hypot(dx, dy) < UMBRAL_TOQUE_PX) {
    return { gesto: { ...gesto, ancla }, anguloGrados, potencia };
  }
  // Movimiento en ejes de juego (y hacia arriba) descompuesto en radial y en
  // tangencial antihorario (-uy, ux).
  const mx = dx;
  const my = -dy;
  const radial = mx * ancla.ux + my * ancla.uy;
  const tangencial = -mx * ancla.uy + my * ancla.ux;
  return {
    gesto: { origen: gesto.origen, ancla, iniciado: true },
    anguloGrados: clampAngulo(ancla.anguloGrados + tangencial * GRADOS_POR_PX_GIRO),
    potencia: clampPotencia(ancla.potencia + radial * FUERZA_POR_PX_RADIAL),
  };
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
