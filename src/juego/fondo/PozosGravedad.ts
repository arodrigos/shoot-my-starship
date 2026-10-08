import type Phaser from "phaser";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import { masaPlaneta, type RegistroPlanetas } from "@/sim/gravedad/planetas";
import { radiosHalo, type AnilloHalo } from "@/sim/gravedad/halos";

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

// Colores: el de los planetas y otro para el agujero negro (masa explícita),
// para que no se confundan cuando coinciden en pantalla.
const COLOR_AGUJERO_NEGRO = 0x9a5bd8;

// Dibuja los halos de gravedad de todos los pozos SOBRE un lienzo que el
// llamador ya tiene abierto (y que horneará él mismo con generateTexture): no
// abre ni cierra ningún `Graphics`, para que el resultado quede fundido en la
// misma textura que el resto del fondo. Cada nivel es una banda anular
// (stroke) entre el radio anterior y el suyo, con su opacidad exacta: con
// círculos rellenos apilados las opacidades se sumarían y no serían las del
// diseño. `masasReferencia` lleva la masa de nacimiento de cada pozo (ver
// radiosHalo). Devuelve los anillos por pozo para exponerlos en __debug.
export function dibujarPozosGravedad(
  lienzo: Phaser.GameObjects.Graphics,
  planetas: RegistroPlanetas,
  masasReferencia: ReadonlyMap<number, number>,
  ancho: number,
  alto: number,
): Array<{ id: number; anillos: AnilloHalo[] }> {
  const pintados: Array<{ id: number; anillos: AnilloHalo[] }> = [];
  for (const planeta of planetas) {
    const anillos = radiosHalo(planeta, masasReferencia.get(planeta.id) ?? masaPlaneta(planeta), ancho, alto);
    const color = planeta.masaFija !== undefined ? COLOR_AGUJERO_NEGRO : COLOR_POZO;
    let interior = planeta.radio;
    for (const anillo of anillos) {
      const grosor = anillo.r - interior;
      if (grosor > 0.5) {
        lienzo.lineStyle(grosor, color, anillo.opacidad);
        lienzo.strokeCircle(planeta.cx, planeta.cy, interior + grosor / 2);
      }
      interior = anillo.r;
    }
    pintados.push({ id: planeta.id, anillos });
  }
  return pintados;
}

// Paso de cuantización de la masa para la firma: un cráter pequeño no debe
// costar un rehorneado, pero perder ~2 % de masa sí mueve los anillos.
const PASO_MASA_RELATIVO = 1.02;

// Lo que decide si hay que rehornear: quién está y su masa viva (que ya lleva
// el multiplicador de gravedad en la densidad), cuantizada para que solo un
// cambio real de masa, no cualquier píxel de cráter, cueste una textura.
export function firmaDeHalos(planetas: RegistroPlanetas): string {
  return planetas.map((planeta) => `${planeta.id}:${planeta.cx}:${planeta.cy}:${Math.round(Math.log(Math.max(1, masaPlaneta(planeta))) / Math.log(PASO_MASA_RELATIVO))}`).join("|");
}
