import type Phaser from "phaser";
import type { TipoObjeto } from "@/sim/universo/tipos";

// Dos siluetas distintas, no solo dos colores: un corazón y una nube con rayo
// (obj-3). Se dibuja centrado en el origen del Graphics, que la escena coloca
// en la posición del objeto.
export function dibujarObjetoEvento(grafico: Phaser.GameObjects.Graphics, tipo: TipoObjeto, radio: number): void {
  grafico.lineStyle(3, 0xffffff, 0.95);
  if (tipo === "corazon") {
    const lobulo = radio * 0.55;
    grafico.fillStyle(0xff4d79, 1);
    grafico.fillCircle(-lobulo, -lobulo * 0.4, lobulo);
    grafico.fillCircle(lobulo, -lobulo * 0.4, lobulo);
    grafico.fillTriangle(-radio * 1.05, 0, radio * 1.05, 0, 0, radio * 1.1);
    grafico.strokeCircle(-lobulo, -lobulo * 0.4, lobulo);
    grafico.strokeCircle(lobulo, -lobulo * 0.4, lobulo);
    return;
  }
  grafico.fillStyle(0x8a7bd8, 1);
  grafico.fillCircle(-radio * 0.5, 0, radio * 0.6);
  grafico.fillCircle(radio * 0.2, -radio * 0.35, radio * 0.75);
  grafico.fillCircle(radio * 0.7, radio * 0.1, radio * 0.5);
  grafico.strokeCircle(radio * 0.2, -radio * 0.35, radio * 0.75);
  grafico.fillStyle(0xffd23f, 1);
  // Rayo en zigzag: dos triángulos que se tocan en el codo.
  grafico.fillTriangle(radio * 0.3, -radio * 0.1, -radio * 0.2, radio * 0.6, radio * 0.28, radio * 0.45);
  grafico.fillTriangle(radio * 0.28, radio * 0.45, -radio * 0.05, radio * 0.55, -radio * 0.1, radio * 1.3);
}
