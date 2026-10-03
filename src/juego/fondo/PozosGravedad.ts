import type Phaser from "phaser";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";

// fondo-y-pozos (fnd-3, reescritura tras el diagnóstico de iteración 31): la
// VPS de CI no tiene GPU real, y Chromium headless-shell cae a un renderer
// de software (SwiftShader) donde el coste de una `Image` con alpha-blending
// no depende del contenido -- depende del área en pantalla del quad, aunque
// la mayoría de sus píxeles sean transparentes. Hornear los pozos como una
// `Image` propia de 1920x1080 (el bloque original) costaba ese quad entero
// CADA fotograma, y sumado al de la capa estelar cercana (otro quad de
// pantalla completa) bastaba para que ~20 e2e preexistentes agotaran su
// timeout esperando animaciones. La función de aquí ya no crea ninguna
// `Image`: dibuja los anillos sobre el MISMO lienzo opaco que hornea
// FondoEspacial, así que el resultado es parte de una única textura estática
// que ya se pagaba antes de este bloque -- cero quads nuevos en tiempo de
// ejecución.

// fondo-y-pozos (fnd-1): transformación de la aceleración REAL que usa el
// integrador (calcularAceleracionGravitatoria, la misma que simularVuelo)
// en una opacidad dibujable. Es monótona y acotada por construcción -- un
// punto donde la gravedad tira más fuerte nunca puede acabar más tenue que
// uno donde tira menos -- así que "un planeta pequeño no puede pintarse con
// un pozo mayor que uno grande" se cumple sin tener que vigilarlo aparte: es
// consecuencia directa de leer la física real en vez de inventar un tamaño a
// partir del radio o de la masa a mano.
// Calibrado contra el rango real de sistemas (RADIO_PLANETA_MIN..MAX = 40..110,
// DENSIDAD_MIN..MAX = 0.6..1.5 en src/sim/sistema/generador.ts): con este
// valor el anillo más lejano (6x el radio) queda apenas visible (~0.05-0.13
// según el tamaño del planeta) y el más cercano (1.1x) satura al tope, así
// que el pozo se ve como un degradado legible y no como un disco plano de
// opacidad constante.
// gravedad-calibracion: CONSTANTE_GRAVITACIONAL subió de 6 a 1200 (200x), y
// la aceleración real que lee esta función escala linealmente con ella --
// sin tocar esto, cualquier punto no trivial del mundo saturaría la alpha
// máxima y el degradado desaparecería. Se divide por los mismos 200x para
// que la calibración visual descrita arriba (apenas visible a 6x el radio,
// saturado a 1.1x) siga valiendo con la física nueva.
const ESCALA_VISUAL_POZO = 0.0008;
const ALPHA_MAXIMA_POZO = 0.5;
const COLOR_POZO = 0x3a6fd8;

export function alphaPozoEnPunto(planetas: RegistroPlanetas, x: number, y: number): number {
  const { x: ax, y: ay } = calcularAceleracionGravitatoria(planetas, x, y);
  const magnitud = Math.sqrt(ax * ax + ay * ay);
  return Math.min(ALPHA_MAXIMA_POZO, magnitud * ESCALA_VISUAL_POZO);
}

// Radios de muestreo, como múltiplo del radio propio de cada planeta: de más
// lejos (más tenue, se pinta primero) a más cerca (más opaco, se pinta al
// final y queda encima). No son el tamaño del pozo -- son los puntos donde
// se LEE alphaPozoEnPunto; el tamaño que de verdad se ve en pantalla lo
// decide esa lectura, no esta lista.
const ANILLOS_RELATIVOS = [6, 4.6, 3.4, 2.4, 1.6, 1.1];

// Umbral por debajo del cual un anillo no aporta nada visible: evita pintar
// fillCircle de alpha ~0 que no cambia un píxel pero sí cuesta CPU en el
// horneado (fnd-3).
const ALPHA_MINIMA_VISIBLE = 0.01;

// Dibuja los anillos de gravedad de todos los planetas SOBRE un lienzo que
// el llamador ya tiene abierto (y que horneará él mismo con generateTexture)
// -- no abre ni cierra ningún `Graphics` propio, para que el resultado quede
// fundido en la misma textura que el resto del fondo. Se llama DESPUÉS de
// pintar las estrellas, para que el halo quede por encima de ellas, igual
// que el orden de profundidad que tenía la `Image` independiente de antes.
export function dibujarPozosGravedad(lienzo: Phaser.GameObjects.Graphics, planetas: RegistroPlanetas): void {
  for (const planeta of planetas) {
    for (const multiplicador of ANILLOS_RELATIVOS) {
      const radio = planeta.radio * multiplicador;
      const alpha = alphaPozoEnPunto(planetas, planeta.cx + radio, planeta.cy);
      if (alpha < ALPHA_MINIMA_VISIBLE) continue;
      lienzo.fillStyle(COLOR_POZO, alpha);
      lienzo.fillCircle(planeta.cx, planeta.cy, radio);
    }
  }
}
