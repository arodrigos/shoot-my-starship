import type Phaser from "phaser";
import { crearGeneradorAleatorio } from "@/sim/aleatorio";

const NUM_ESTRELLAS_CERCANAS = 70;
const MARGEN_PARALAJE_PX = 10;

export interface EstrellaCercana {
  readonly x: number;
  readonly y: number;
  readonly radio: number;
  readonly brillo: number;
}

// fondo-y-pozos (fnd-2): semilla derivada por XOR con una constante fija
// (nunca Date.now ni Math.random) para que esta capa no repita punto por
// punto el mismo patrón que crearFondoEspacial con el mismo generador, pero
// siga siendo la semilla del sistema la que decide el cielo entero.
const DESPLAZAMIENTO_SEMILLA_CERCANA = 0x9e3779b9;

export function generarEstrellasCercanas(semilla: number, ancho: number, alto: number): readonly EstrellaCercana[] {
  const aleatorio = crearGeneradorAleatorio((semilla ^ DESPLAZAMIENTO_SEMILLA_CERCANA) >>> 0);
  const estrellas: EstrellaCercana[] = [];
  for (let i = 0; i < NUM_ESTRELLAS_CERCANAS; i++) {
    estrellas.push({
      x: aleatorio() * ancho,
      y: aleatorio() * alto,
      radio: 1.4 + aleatorio() * 1.6,
      brillo: 0.7 + aleatorio() * 0.3,
    });
  }
  return estrellas;
}

export interface CapaEstelarCercana {
  readonly imagen: Phaser.GameObjects.Image;
  actualizar(deltaMs: number): void;
}

const AMPLITUD_DERIVA_PX = 6;
// Un ciclo completo cada 20s: "suave" a propósito, nada que distraiga de la
// partida ni que se note como parpadeo.
const FRECUENCIA_DERIVA_HZ = 0.05;

// fondo-y-pozos (fnd-2): capa "cercana" del paralaje -- estrellas más
// grandes y brillantes que las de crearFondoEspacial, con una deriva propia
// e independiente de la cámara. No se ata a cameras.main porque la sacudida
// de realce-impacto traslada la matriz de la cámara directamente
// (Shake.preRender, camera.matrix.translate) sin pasar por scrollFactor, así
// que dos capas con distinto scrollFactor se moverían exactamente igual
// durante una sacudida -- la única forma de que esta capa se perciba más
// cercana que la otra es moverla con un reloj propio, más rápido y con más
// amplitud que la capa lejana (que no se mueve en absoluto). Es una
// oscilación, no un scroll infinito: evita el problema de costura de un
// TileSprite con una textura no pensada para repetir sin unión visible.
export function crearCapaEstelarCercana(
  escena: Phaser.Scene,
  semilla: number,
  ancho: number,
  alto: number,
  claveTextura: string,
): CapaEstelarCercana {
  const estrellas = generarEstrellasCercanas(semilla, ancho, alto);
  const anchoTextura = ancho + MARGEN_PARALAJE_PX * 2;
  const altoTextura = alto + MARGEN_PARALAJE_PX * 2;
  const lienzo = escena.make.graphics({ x: 0, y: 0 });

  for (const estrella of estrellas) {
    lienzo.fillStyle(0xdfe9ff, estrella.brillo);
    lienzo.fillCircle(MARGEN_PARALAJE_PX + estrella.x, MARGEN_PARALAJE_PX + estrella.y, estrella.radio);
  }

  lienzo.generateTexture(claveTextura, anchoTextura, altoTextura);
  lienzo.destroy();

  // Depth -0.8: delante de la capa lejana (-1), detrás de los pozos de
  // gravedad (-0.5) y del terreno. El margen se descuenta del origen para
  // que la oscilación nunca deje un borde del mundo sin cubrir.
  const imagen = escena.add.image(-MARGEN_PARALAJE_PX, -MARGEN_PARALAJE_PX, claveTextura).setOrigin(0, 0).setDepth(-0.8);

  let tiempoMs = 0;
  return {
    imagen,
    actualizar(deltaMs: number) {
      tiempoMs += deltaMs;
      const fase = (tiempoMs / 1000) * FRECUENCIA_DERIVA_HZ * Math.PI * 2;
      imagen.x = -MARGEN_PARALAJE_PX + Math.sin(fase) * AMPLITUD_DERIVA_PX;
      imagen.y = -MARGEN_PARALAJE_PX + Math.cos(fase * 0.7) * AMPLITUD_DERIVA_PX * 0.5;
    },
  };
}
