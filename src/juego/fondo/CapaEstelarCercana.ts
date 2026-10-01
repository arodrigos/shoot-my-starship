import type Phaser from "phaser";
import { crearGeneradorAleatorio } from "@/sim/aleatorio";

const NUM_ESTRELLAS_CERCANAS = 70;

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

// fondo-y-pozos (fnd-2, reescritura tras el diagnóstico de iteración 31): la
// versión original dibujaba esta capa como una `Image` de pantalla completa
// propia, con una deriva (oscilación) animada para sugerir cercanía. En el
// renderer de software de la VPS de CI (sin GPU), ese quad extra -- sumado
// al de los pozos de gravedad -- costaba lo bastante como para que ~20 e2e
// preexistentes agotaran su timeout esperando animaciones (ver el PR #62 y
// el hueco de la iteración 31). La deriva no se puede hornear de forma
// estática por definición, así que se sacrifica: esta función ya no crea
// ningún `Image` ni anima nada -- dibuja las estrellas cercanas (más
// grandes y brillantes que las de crearFondoEspacial, que es lo que de
// verdad sostiene la sensación de dos capas) sobre el MISMO lienzo opaco
// que hornea FondoEspacial, así que la profundidad se queda en el contraste
// de tamaño y brillo entre capas, no en el movimiento.
export function dibujarEstrellasCercanas(lienzo: Phaser.GameObjects.Graphics, estrellas: readonly EstrellaCercana[]): void {
  for (const estrella of estrellas) {
    lienzo.fillStyle(0xdfe9ff, estrella.brillo);
    lienzo.fillCircle(estrella.x, estrella.y, estrella.radio);
  }
}
