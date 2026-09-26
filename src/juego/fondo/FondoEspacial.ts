import type Phaser from "phaser";
import { crearGeneradorAleatorio } from "@/sim/aleatorio";

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
export function crearFondoEspacial(
  escena: Phaser.Scene,
  semilla: number,
  ancho: number,
  alto: number,
  claveTextura: string,
): FondoEspacial {
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

  lienzo.generateTexture(claveTextura, ancho, alto);
  lienzo.destroy();

  const imagen = escena.add.image(0, 0, claveTextura).setOrigin(0, 0).setDepth(-1);
  return { imagen };
}
