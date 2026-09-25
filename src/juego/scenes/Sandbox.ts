import Phaser from "phaser";
import { MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { generarMascara } from "@/sim/terreno/generador";
import { crearTerrenoPhaser } from "@/juego/terreno/crearTerrenoPhaser";
import { generarGuionDeHuellas } from "@/juego/depuracion/guionDeHuellas";
import { exponerDepuracionDeTerreno } from "@/juego/depuracion/exponerTerreno";
import "@/debug/tipos";

// Semilla fija de esta escena de pruebas: no es la partida real (eso lo
// decide nucleo-turnos), solo necesita ser la misma en cada carga para que
// terreno-3 sea reproducible.
const SEMILLA_SANDBOX = 424242;

// Escena mínima de andamiaje, ahora con el terreno del bloque
// terreno-mascara montado encima para poder verificarlo con Playwright
// (terreno-3, terreno-6) antes de que exista la escena real del juego.
// Los bloques siguientes (nucleo-turnos, render-juego...) sustituyen esto.
export class Sandbox extends Phaser.Scene {
  constructor() {
    super("Sandbox");
  }

  create(): void {
    window.__debug = window.__debug ?? {};

    const mascara = generarMascara(SEMILLA_SANDBOX, MUNDO_ANCHO, MUNDO_ALTO);
    const { terreno } = crearTerrenoPhaser(this, mascara, "terreno-sandbox");

    // El guion de huellas se aplica al crear la escena, no bajo demanda del
    // test: terreno-3 pide "una página de pruebas que aplica el guion", y
    // así el test solo tiene que esperar a `listo` antes de comprobar.
    for (const huella of generarGuionDeHuellas(MUNDO_ANCHO, MUNDO_ALTO)) {
      terreno.aplicarHuella(huella.cx, huella.cy, huella.radio, huella.signo);
    }

    const texturaCanvas = this.textures.get("terreno-sandbox") as Phaser.Textures.CanvasTexture;
    exponerDepuracionDeTerreno(terreno, mascara, texturaCanvas);
    window.__debug.terreno!.listo = true;

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
