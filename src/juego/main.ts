import Phaser from "phaser";
import { configurarTamanoMundo, MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { calcularTamanoContenedorJuego } from "@/juego/layoutContenedor";
import { Sandbox } from "@/juego/scenes/Sandbox";
import { Siluetas } from "@/juego/scenes/Siluetas";
import { Partida } from "@/juego/escenas/Partida";
import type { JugadorConfig } from "@/juego/jugadores";
import type { ModoJuego } from "@/sim/partida/tipos";

export type IdEscena = "partida" | "sandbox" | "siluetas";

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
  // modos-y-presupuesto: ausente es "barra-libre" (el comportamiento de
  // siempre, ver Partida.ts create()).
  readonly modo?: ModoJuego;
  // multi-setup-partida: quién juega (de 2 a 4 asientos, humanos primero).
  // Ausente es la partida de siempre: un humano contra `personalidadId`.
  readonly jugadores?: readonly JugadorConfig[];
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
    // arte-siluetas-5 (novena corrección): sin esto, canvas.toDataURL() lee
    // el buffer de dibujo de WebGL ya borrado tras presentarse -- medido con
    // el simulador real (diag arte-siluetas-5 contra "calma-de-los-restos"):
    // el único fotograma en el que el proyectil cayó dentro del lienzo y
    // lejos del HUD dio pixelmatch=0 frente al fondo, es decir, invisible
    // para toDataURL() aunque la posición lógica fuera correcta. El coste es
    // un pequeño margen de memoria de framebuffer, no de CPU por fotograma.
    preserveDrawingBuffer: true,
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

// encuadre-movil: solo la escena de partida necesita el mundo reconfigurado
// -- Sandbox y Siluetas son escenas de depuración (/pruebas/...) que ya
// asumen 1920x1080 en su propio código y no forman parte del camino
// jugable en móvil, así que tocarlas ahí sería una migración sin bloque.
// Se mide el contenedor real en vez de window.innerWidth/innerHeight
// porque layout-dos-zonas solo le reserva el 58% del alto de la ventana al
// lienzo (ver layoutContenedor.ts): el aspecto que importa es el del hueco
// disponible, no el del viewport completo.
function ajustarMundoAlContenedor(contenedor: string): void {
  const elemento = document.getElementById(contenedor);
  if (elemento === null) {
    return;
  }
  const rect = elemento.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    configurarTamanoMundo(rect.width, rect.height);
    return;
  }
  // jsdom y algunos entornos sin layout real devuelven un rect en 0x0 --
  // calcularTamanoContenedorJuego reproduce el mismo 58% a partir del
  // viewport para no dejar el mundo en el tamaño por defecto sin motivo.
  const { ancho, alto } = calcularTamanoContenedorJuego(window.innerWidth, window.innerHeight);
  configurarTamanoMundo(ancho, alto);
}

export function iniciarJuego(
  contenedor: string,
  idEscena: IdEscena = "partida",
  datosEscena?: DatosEscenaPartida,
): Phaser.Game {
  if (idEscena === "partida") {
    ajustarMundoAlContenedor(contenedor);
  }
  const juego = new Phaser.Game(crearConfiguracion(contenedor));
  // La clave pasada aquí tiene que coincidir con el super(key) de cada
  // escena (Partida.ts, Sandbox.ts) -- Phaser identifica la escena por esa
  // clave, no por la posición en el array de configuración.
  if (idEscena === "sandbox") {
    juego.scene.add("Sandbox", Sandbox, true, datosEscena);
  } else if (idEscena === "siluetas") {
    juego.scene.add("Siluetas", Siluetas, true, datosEscena);
  } else {
    juego.scene.add("Partida", Partida, true, datosEscena);
  }
  return juego;
}
