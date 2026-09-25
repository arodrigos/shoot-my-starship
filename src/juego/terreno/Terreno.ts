import { aplicarHuellaCircular, type RectanguloSucio, type SignoHuella } from "@/sim/terreno/huella";
import { esSolido, type Mascara } from "@/sim/terreno/mascara";

// Lo que sabe dibujar el rectángulo sucio tras un impacto. Es una interfaz
// y no una clase Phaser concreta a propósito: terreno-5 (qué rectángulo se
// pide refrescar) se comprueba con un doble de prueba en Node, sin arrancar
// un navegador ni una GPU.
export interface SuperficieDeTerreno {
  refrescarRectangulo(mascara: Mascara, rectangulo: RectanguloSucio): void;
}

// Único punto de código que modifica la máscara Y la textura visible a la
// vez (terreno-3): ninguna otra parte del juego debe llamar a
// aplicarHuellaCircular directamente, porque hacerlo dejaría la textura sin
// refrescar y es exactamente el fallo clásico del género (se ve el agujero
// pero el proyectil sigue chocando, o al revés).
export class Terreno {
  constructor(
    private readonly mascara: Mascara,
    private readonly superficie: SuperficieDeTerreno,
  ) {}

  esSolido(x: number, y: number): boolean {
    return esSolido(this.mascara, x, y);
  }

  aplicarHuella(cx: number, cy: number, radio: number, signo: SignoHuella): RectanguloSucio {
    const rectangulo = aplicarHuellaCircular(this.mascara, cx, cy, radio, signo);
    this.superficie.refrescarRectangulo(this.mascara, rectangulo);
    return rectangulo;
  }
}
