import Phaser from "phaser";
import { MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { Sandbox } from "@/juego/scenes/Sandbox";

// RESIZE: el lienzo ocupa siempre el viewport entero (sin barras de
// letterbox), que es lo que hace que "30% del ancho de pantalla" sea la
// misma fracción del lienzo en cualquier tamaño -- la propiedad que
// andamiaje-1 comprueba. El mundo lógico (MUNDO_ANCHO x MUNDO_ALTO) es fijo
// y ajeno al tamaño del lienzo; la conversión vive en cada escena.
function crearConfiguracion(contenedor: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    parent: contenedor,
    backgroundColor: "#12141a",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: MUNDO_ANCHO,
      height: MUNDO_ALTO,
    },
    scene: [Sandbox],
  };
}

export function iniciarJuego(contenedor: string): Phaser.Game {
  return new Phaser.Game(crearConfiguracion(contenedor));
}
