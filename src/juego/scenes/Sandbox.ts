import Phaser from "phaser";
import { MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import "@/debug/tipos";

// Escena mínima de este bloque: solo demuestra la frontera de entrada
// (toque -> coordenada de mundo) que andamiaje-1 exige. Los bloques
// siguientes (terreno-mascara, nucleo-turnos, render-juego...) sustituyen
// esto por las escenas reales del juego.
export class Sandbox extends Phaser.Scene {
  constructor() {
    super("Sandbox");
  }

  create(): void {
    window.__debug = window.__debug ?? {};

    const marca = this.add.circle(-100, -100, 8, 0xffcc00).setVisible(false);

    this.input.on("pointerdown", (puntero: Phaser.Input.Pointer) => {
      // La conversión a fracción del lienzo y de ahí a coordenada de mundo
      // ocurre aquí mismo, en el único sitio que toca pointer.x/y: ninguna
      // coordenada de pantalla llega más lejos que este manejador.
      const fraccionX = puntero.x / this.scale.width;
      const fraccionY = puntero.y / this.scale.height;
      const mundoX = fraccionX * MUNDO_ANCHO;
      const mundoY = fraccionY * MUNDO_ALTO;

      window.__debug.ultimoPunto = { x: mundoX, y: mundoY };

      marca.setPosition(puntero.x, puntero.y).setVisible(true);
    });
  }
}
