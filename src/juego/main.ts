import Phaser from "phaser";
import { MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { Sandbox } from "@/juego/scenes/Sandbox";
import { Partida } from "@/juego/escenas/Partida";

export type IdEscena = "partida" | "sandbox";

// FIT + CENTER_BOTH (render-4, sustituye el RESIZE de andamiaje-1): el
// lienzo se ajusta dentro del viewport conservando el aspecto de
// MUNDO_ANCHO x MUNDO_ALTO en vez de estirar el mundo lógico -- así el
// campo de batalla ENTERO es siempre visible, a 360 px o a escritorio, sin
// necesitar que ninguna escena persiga con la cámara para cubrir el hueco.
// this.scale.width/height siguen siendo el tamaño de juego fijo (no el
// tamaño en CSS) bajo cualquier modo de escala, así que la conversión
// gesto->coordenada de mundo de andamiaje-1 y de render-1 no cambia.
function crearConfiguracion(contenedor: string, idEscena: IdEscena): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    parent: contenedor,
    backgroundColor: "#12141a",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: MUNDO_ANCHO,
      height: MUNDO_ALTO,
    },
    scene: [idEscena === "sandbox" ? Sandbox : Partida],
  };
}

export function iniciarJuego(contenedor: string, idEscena: IdEscena = "partida"): Phaser.Game {
  return new Phaser.Game(crearConfiguracion(contenedor, idEscena));
}
