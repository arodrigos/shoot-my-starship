import type Phaser from "phaser";
import { crearGeneradorAleatorio } from "@/sim/aleatorio";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { generarEstrellasCercanas, dibujarEstrellasCercanas } from "@/juego/fondo/CapaEstelarCercana";
import { dibujarPozosGravedad } from "@/juego/fondo/PozosGravedad";
import type { AnilloHalo } from "@/sim/gravedad/halos";

export type HalosPintados = Array<{ id: number; anillos: AnilloHalo[] }>;

const NUM_ESTRELLAS = 260;
const NUM_NUBES_NEBULOSA = 5;

export interface FondoEspacial {
  readonly imagen: Phaser.GameObjects.Image;
}

// render-espacio (esp-3): el fondo de estrellas y nebulosa se hornea UNA
// sola vez con this.make.graphics()+generateTexture() -- nunca se redibuja
// por turno ni por impacto, porque no es terreno (no colisiona, ninguna
// huella de arma lo toca). La semilla es la del sistema, no Math.random
// (esto vive en src/juego, no en src/sim, así que Math.random no está
// prohibido aquí -- pero determinismo entre cargas es justo lo que exige
// render-1 para el mundo por defecto, y reutilizar el mismo PRNG con
// semilla que ya usa el resto del juego es gratis). setDepth(-1) lo deja
// detrás de la imagen de terreno, que se crea después.
//
// fondo-y-pozos (fnd-1, fnd-2, fnd-3): la capa estelar cercana y los pozos
// de gravedad se funden en ESTE MISMO lienzo antes de hornear, en vez de
// vivir como `Image` propias -- ver el porqué en los comentarios de
// CapaEstelarCercana.ts y PozosGravedad.ts (coste de compositing en el
// renderer de software de CI). El resultado sigue siendo UNA sola textura
// opaca y UN solo bake, así que esp-3 (fondoEspacial.bakes === 1 para
// siempre) no cambia.
export function crearFondoEspacial(
  escena: Phaser.Scene,
  semilla: number,
  ancho: number,
  alto: number,
  claveTextura: string,
  planetas: RegistroPlanetas,
  masasReferencia: ReadonlyMap<number, number>,
): FondoEspacial & { halos: HalosPintados } {
  const halos = hornearFondo(escena, semilla, ancho, alto, claveTextura, planetas, masasReferencia);
  const imagen = escena.add.image(0, 0, claveTextura).setOrigin(0, 0).setDepth(-1);
  return { imagen, halos };
}

const LADO_MOSAICO_EXTERIOR = 512;
const MARGEN_EXTERIOR_FACTOR = 2;

export interface FondoExterior {
  readonly arriba: Phaser.GameObjects.TileSprite;
  readonly abajo: Phaser.GameObjects.TileSprite;
  readonly izquierda: Phaser.GameObjects.TileSprite;
  readonly derecha: Phaser.GameObjects.TileSprite;
}

// Con la cámara alejada se ve más allá del mundo y ahí solo había el negro del
// renderer (franjas lisas con borde recto). Cuatro franjas de un mosaico
// pequeño de estrellas, solo por fuera del mundo, lo rellenan sin tocar el
// bake único del fondo (esp-3). Son franjas y no un tapiz bajo el mundo
// porque el relleno duplicado por debajo hundía los fps del render por software.
export function crearFondoExterior(escena: Phaser.Scene, semilla: number, ancho: number, alto: number): FondoExterior {
  const clave = "fondo-exterior";
  if (!escena.textures.exists(clave)) {
    const aleatorio = crearGeneradorAleatorio(semilla ^ 0x5bd1e995);
    const lienzo = escena.make.graphics({ x: 0, y: 0 });
    lienzo.fillStyle(0x05060c, 1);
    lienzo.fillRect(0, 0, LADO_MOSAICO_EXTERIOR, LADO_MOSAICO_EXTERIOR);
    for (let i = 0; i < 70; i++) {
      lienzo.fillStyle(0xffffff, 0.35 + aleatorio() * 0.55);
      lienzo.fillCircle(aleatorio() * LADO_MOSAICO_EXTERIOR, aleatorio() * LADO_MOSAICO_EXTERIOR, 0.6 + aleatorio() * 1.2);
    }
    lienzo.generateTexture(clave, LADO_MOSAICO_EXTERIOR, LADO_MOSAICO_EXTERIOR);
    lienzo.destroy();
  }
  const mx = ancho * MARGEN_EXTERIOR_FACTOR;
  const my = alto * MARGEN_EXTERIOR_FACTOR;
  const franja = (x: number, y: number, w: number, h: number): Phaser.GameObjects.TileSprite =>
    escena.add.tileSprite(x, y, w, h, clave).setOrigin(0, 0).setDepth(-2).setVisible(false);
  return {
    arriba: franja(-mx, -my, ancho + 2 * mx, my),
    abajo: franja(-mx, alto, ancho + 2 * mx, my),
    izquierda: franja(-mx, 0, mx, alto),
    derecha: franja(ancho, 0, mx, alto),
  };
}

// Vuelve a pintar el fondo sobre la MISMA textura (Phaser dibuja encima del
// canvas existente y el fondo es opaco): los halos de gravedad cambian con los
// efectos del universo, y sin esto se quedarían como al crear la escena. Se
// llama solo cuando cambia la masa del registro, nunca por fotograma.
export function rehornearFondoEspacial(
  escena: Phaser.Scene,
  semilla: number,
  ancho: number,
  alto: number,
  claveTextura: string,
  planetas: RegistroPlanetas,
  masasReferencia: ReadonlyMap<number, number>,
): HalosPintados {
  return hornearFondo(escena, semilla, ancho, alto, claveTextura, planetas, masasReferencia);
}

function hornearFondo(
  escena: Phaser.Scene,
  semilla: number,
  ancho: number,
  alto: number,
  claveTextura: string,
  planetas: RegistroPlanetas,
  masasReferencia: ReadonlyMap<number, number>,
): HalosPintados {
  const aleatorio = crearGeneradorAleatorio(semilla);
  const lienzo = escena.make.graphics({ x: 0, y: 0 });

  lienzo.fillStyle(0x05060c, 1);
  lienzo.fillRect(0, 0, ancho, alto);

  // Nebulosa: unos pocos manchones grandes y translúcidos, pintados antes
  // que las estrellas para que estas queden por encima, no al revés.
  for (let i = 0; i < NUM_NUBES_NEBULOSA; i++) {
    const cx = aleatorio() * ancho;
    const cy = aleatorio() * alto;
    const radio = 200 + aleatorio() * 320;
    const tono = aleatorio() < 0.5 ? 0x2a1f4a : 0x1f3a4a;
    lienzo.fillStyle(tono, 0.1 + aleatorio() * 0.08);
    lienzo.fillCircle(cx, cy, radio);
  }

  for (let i = 0; i < NUM_ESTRELLAS; i++) {
    const x = aleatorio() * ancho;
    const y = aleatorio() * alto;
    const radio = 0.6 + aleatorio() * 1.6;
    const brillo = 0.4 + aleatorio() * 0.6;
    lienzo.fillStyle(0xffffff, brillo);
    lienzo.fillCircle(x, y, radio);
  }

  // Capa "cercana" del paralaje: mismo generador que antes (semilla propia
  // derivada por XOR, ver DESPLAZAMIENTO_SEMILLA_CERCANA), estrellas más
  // grandes y brillantes, pintadas encima de las lejanas.
  const estrellasCercanas = generarEstrellasCercanas(semilla, ancho, alto);
  dibujarEstrellasCercanas(lienzo, estrellasCercanas);

  // Pozos de gravedad: al final, para que el halo quede por encima de las
  // estrellas -- mismo orden de profundidad que tenían las tres `Image`
  // separadas (-1, -0.8, -0.5).
  const halos = dibujarPozosGravedad(lienzo, planetas, masasReferencia, ancho, alto);

  lienzo.generateTexture(claveTextura, ancho, alto);
  lienzo.destroy();
  return halos;
}
