import Phaser from "phaser";

// arma-mina-adherente (min-2): cuenta atrás ANCLADA AL MUNDO, en el punto
// exacto donde la mina se pegó -- a diferencia de la Granada (CuentaAtrasHUD,
// un overlay DOM con position:fixed en la esquina de pantalla), este
// contador es un GameObject de Phaser más, con scroll factor normal (1,1,
// el valor por defecto): sigue el punto de adherencia en el MUNDO, no un
// hueco fijo de pantalla. Eso hace que su rectángulo sea disjunto de
// cualquier panel del HUD por construcción geométrica (vive dentro del
// lienzo, ellos son DOM fuera de él), no por una coincidencia de layout que
// pudiera romperse si algún panel cambiara de sitio.
// render-4: Phaser.Scale.FIT reduce el lienzo entero (1920x1080 lógicos) a
// lo que quepa en el viewport real -- a 360x640 son ~202px de alto, un
// factor ~0,19. Un texto de mundo dibujado a su tamaño de fuente literal
// heredaría ese mismo encogido (el lienzo entero se escala como una sola
// imagen) y terminaría en unos pocos píxeles CSS, ilegible -- justo lo que
// le pasaría a CuentaAtrasHUD si viviera dentro del lienzo en vez de como
// overlay DOM. `scale.displayScale` YA es baseSize/displaySize (a 360 de
// ancho vale 1920/360 = 5,33): es directamente el factor de compensación,
// no su inverso -- multiplicar la fuente y el acolchado en mundo por ese
// valor (min-2, hallazgo del gatekeeper: la versión anterior usaba 1/displayScale
// y encogía el texto en vez de agrandarlo) hace que el tamaño VISTO en
// pantalla sea el mismo con independencia del viewport, sin perder la
// ancla al punto de mundo donde se pegó la mina.
const TAMANO_FUENTE_CSS_PX = 20;
const PADDING_X_CSS_PX = 6;
const PADDING_Y_CSS_PX = 4;
const DESPLAZAMIENTO_VERTICAL_CSS_PX = 28;

export class ContadorAdherencia {
  private readonly texto: Phaser.GameObjects.Text;
  private readonly compensacionEscala: number;

  constructor(escena: Phaser.Scene) {
    this.compensacionEscala = escena.scale.displayScale.x;
    this.texto = escena.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: `${Math.round(TAMANO_FUENTE_CSS_PX * this.compensacionEscala)}px`,
        fontStyle: "bold",
        color: "#ffd9d9",
        backgroundColor: "#2a0a0a",
        padding: { x: PADDING_X_CSS_PX * this.compensacionEscala, y: PADDING_Y_CSS_PX * this.compensacionEscala },
      })
      .setOrigin(0.5, 1)
      .setDepth(60)
      .setVisible(false);
  }

  // Null en cualquiera de los dos -- vuelo que no es de una mina, mina que
  // todavía no se ha pegado, o mina ya detonada -- apaga el texto en vez de
  // dejarlo pegado con el último valor que tuvo.
  actualizar(posicion: { readonly x: number; readonly y: number } | null, segundosRestantes: number | null): void {
    if (posicion === null || segundosRestantes === null) {
      this.texto.setVisible(false);
      return;
    }
    this.texto.setText(String(segundosRestantes));
    // DESPLAZAMIENTO_VERTICAL_CSS_PX por encima del punto de adherencia (ya
    // compensado a mundo): lo bastante, en pantalla, para no tapar el propio
    // agujero/silueta que dejó la mina al pegarse.
    this.texto.setPosition(posicion.x, posicion.y - DESPLAZAMIENTO_VERTICAL_CSS_PX * this.compensacionEscala);
    this.texto.setVisible(true);
  }
}
