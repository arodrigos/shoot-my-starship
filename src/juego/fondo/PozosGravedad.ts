import type Phaser from "phaser";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";

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
const ESCALA_VISUAL_POZO = 0.16;
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

export interface PozosGravedad {
  readonly imagen: Phaser.GameObjects.Image;
}

// Se hornea UNA vez con generateTexture, igual que crearFondoEspacial: no es
// terreno (no colisiona, ninguna huella de arma lo toca) y, a diferencia de
// la máscara de terreno, las masas de planetas solo cambian al cerrar un
// turno, nunca dentro del bucle de un vuelo -- repintar en cada creación de
// escena (una por partida en el hito espacial) ya refleja el sistema con el
// que de verdad se va a jugar. setDepth(-0.5): detrás del terreno y las
// naves, delante del fondo estelar.
export function crearPozosGravedad(
  escena: Phaser.Scene,
  planetas: RegistroPlanetas,
  ancho: number,
  alto: number,
  claveTextura: string,
): PozosGravedad {
  const lienzo = escena.make.graphics({ x: 0, y: 0 });

  for (const planeta of planetas) {
    for (const multiplicador of ANILLOS_RELATIVOS) {
      const radio = planeta.radio * multiplicador;
      const alpha = alphaPozoEnPunto(planetas, planeta.cx + radio, planeta.cy);
      if (alpha < ALPHA_MINIMA_VISIBLE) continue;
      lienzo.fillStyle(COLOR_POZO, alpha);
      lienzo.fillCircle(planeta.cx, planeta.cy, radio);
    }
  }

  lienzo.generateTexture(claveTextura, ancho, alto);
  lienzo.destroy();

  const imagen = escena.add.image(0, 0, claveTextura).setOrigin(0, 0).setDepth(-0.5);
  return { imagen };
}
