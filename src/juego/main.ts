import Phaser from "phaser";
import { MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { Sandbox } from "@/juego/scenes/Sandbox";
import { Partida } from "@/juego/escenas/Partida";

export type IdEscena = "partida" | "sandbox";

// partida-completa: qué rival y qué mapa arrancan la escena real -- la
// pantalla de inicio los decide fuera del lienzo, Partida.init(datos) los
// recibe dentro.
export interface DatosEscenaPartida {
  readonly mapaId?: string;
  readonly personalidadId?: string;
  // render-espacio: semilla del sistema planetario para el hito espacial --
  // aditiva y mutuamente excluyente con mapaId (si llega mapaId, gana el
  // modo de suelo plano de siempre; ver Partida.ts create()).
  readonly semillaSistema?: number;
}

// FIT + CENTER_BOTH (render-4, sustituye el RESIZE de andamiaje-1): el
// lienzo se ajusta dentro del viewport conservando el aspecto de
// MUNDO_ANCHO x MUNDO_ALTO en vez de estirar el mundo lógico -- así el
// campo de batalla ENTERO es siempre visible, a 360 px o a escritorio, sin
// necesitar que ninguna escena persiga con la cámara para cubrir el hueco.
// this.scale.width/height siguen siendo el tamaño de juego fijo (no el
// tamaño en CSS) bajo cualquier modo de escala, así que la conversión
// gesto->coordenada de mundo de andamiaje-1 y de render-1 no cambia.
function crearConfiguracion(contenedor: string): Phaser.Types.Core.GameConfig {
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
    // La escena se añade a mano justo debajo (game.scene.add(..., true,
    // datos)), no aquí: es la única forma de pasarle datos de arranque
    // (rival, mapa) sin depender de un scene.start() posterior que Phaser
    // pudiera encolar después del primer fotograma.
    scene: [],
  };
}

export function iniciarJuego(
  contenedor: string,
  idEscena: IdEscena = "partida",
  datosEscena?: DatosEscenaPartida,
): Phaser.Game {
  const juego = new Phaser.Game(crearConfiguracion(contenedor));
  // La clave pasada aquí tiene que coincidir con el super(key) de cada
  // escena (Partida.ts, Sandbox.ts) -- Phaser identifica la escena por esa
  // clave, no por la posición en el array de configuración.
  if (idEscena === "sandbox") {
    juego.scene.add("Sandbox", Sandbox, true, datosEscena);
  } else {
    juego.scene.add("Partida", Partida, true, datosEscena);
  }
  return juego;
}
