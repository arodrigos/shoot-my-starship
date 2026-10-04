import Phaser from "phaser";

// Referencia de escala visual: los mapas del catálogo se mueven en
// +-30 px/s² aprox., así que una deriva de esta magnitud ya llena la flecha
// entera -- por encima de esto se satura, no se sale del HUD.
const DERIVA_REFERENCIA_PX_S2 = 30;
const LONGITUD_MAXIMA_PX = 70;
const LONGITUD_MINIMA_VISIBLE_PX = 6;
const TAMANO_FUENTE_CSS_PX = 16;
// hud-canales (undécima corrección): la etiqueta más larga del catálogo
// (41 caracteres, "Sin corriente: el cementerio está en calma") medía 357px
// CSS a TAMANO_FUENTE_CSS_PX -- más ancha que los 360px del viewport de
// referencia, así que se cortaba por los dos lados del centro aunque
// setOrigin(0.5,0) la centrara bien. 320px deja 20px de margen a cada lado
// en 360px de ancho; con wordWrap, Phaser parte en la línea más que haga
// falta en vez de desbordar.
const ANCHURA_MAXIMA_ETIQUETA_CSS_PX = 320;

export interface EstadoDerivaDibujado {
  readonly valorMundo: number;
  readonly etiqueta: string;
  readonly sentido: -1 | 0 | 1;
  readonly longitudFlechaPx: number;
  // hud-canales-1 (undécima corrección): bordes reales de la etiqueta en
  // CSS px, para que el e2e compruebe que cabe en el lienzo sin tener que
  // leer píxeles de una captura a ojo.
  readonly etiquetaBordeIzquierdoCssPx: number;
  readonly etiquetaBordeDerechoCssPx: number;
}

// Flecha + etiqueta en la esquina superior: el único sitio del HUD que
// depende de mundo.deriva, para que render-6 pueda comprobar que la
// magnitud y el sentido dibujados corresponden al dato real del mapa y no a
// un adorno fijo.
export class IndicadorDeriva {
  private readonly grafico: Phaser.GameObjects.Graphics;
  private readonly texto: Phaser.GameObjects.Text;
  private readonly x: number;
  private readonly y: number;
  private readonly xCss: number;
  private readonly compensacionEscala: number;

  // hud-canales-1 (quinta corrección): x/y ya no son unidades de juego
  // fijas -- son el destino en CSS px DENTRO del lienzo (misma unidad que
  // los botones fixed de ControlHUD), convertido con displayScale.x
  // (gameUnits/CSSpx) para que la posición real en pantalla no dependa del
  // tamaño del mundo lógico. Con (90,40) fijos en unidades de juego, al
  // pasar MUNDO_ANCHO de 1920 a ~1080 (encuadre-movil) el indicador se
  // quedó pintándose a ~(30,13)-(30,19) CSS, justo encima del botón
  // Histórico (10-98, 10-54): existía y no se veía, por la misma razón que
  // el punto 6 del brief. CSS (180,70) cae por debajo de los 54px de la
  // banda de botones fixed y centrado, lejos de Histórico/Sacudida/Sonido.
  constructor(escena: Phaser.Scene, xCss: number, yCss: number) {
    // hud-canales (corrección): único texto de canvas que no compensaba
    // scale.displayScale -- en 360px de ancho el displayScale ronda 5.33x,
    // así que 16px "de juego" se pintaban a ~3px CSS reales (1,31:1 medido
    // por el gatekeeper). Mismo patrón que ContadorAdherencia.ts.
    const compensacionEscala = escena.scale.displayScale.x;
    this.compensacionEscala = compensacionEscala;
    this.xCss = xCss;
    this.x = xCss * compensacionEscala;
    this.y = yCss * compensacionEscala;
    this.grafico = escena.add.graphics().setScrollFactor(0).setDepth(100);
    // hud-canales (octava corrección): el origen por defecto de Phaser es
    // arriba-izquierda, así que el texto EMPEZABA en xCss (180, el centro
    // de 360px) y se salía por el borde derecho -- el comentario de más
    // arriba decía "centrado" pero nada llamaba a setOrigin. Con origin
    // (0.5, 0) el texto queda centrado en self.x sea cual sea su longitud,
    // y a 360px de ancho la etiqueta más larga del catálogo (41
    // caracteres) cabe entera a los dos lados del centro.
    this.texto = escena.add
      .text(this.x, this.y + 18 * compensacionEscala, "", {
        fontSize: `${Math.round(TAMANO_FUENTE_CSS_PX * compensacionEscala)}px`,
        color: "#f2f2f2",
        align: "center",
        wordWrap: { width: ANCHURA_MAXIMA_ETIQUETA_CSS_PX * compensacionEscala, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);
  }

  actualizar(valorMundo: number, etiqueta: string): EstadoDerivaDibujado {
    const sentido: -1 | 0 | 1 = valorMundo > 0 ? 1 : valorMundo < 0 ? -1 : 0;
    const magnitudNormalizada = Math.min(1, Math.abs(valorMundo) / DERIVA_REFERENCIA_PX_S2);
    const longitudFlechaPx = sentido === 0 ? 0 : LONGITUD_MINIMA_VISIBLE_PX + magnitudNormalizada * (LONGITUD_MAXIMA_PX - LONGITUD_MINIMA_VISIBLE_PX);

    this.grafico.clear();
    this.grafico.lineStyle(4, 0xffcc55, 1);
    if (sentido !== 0) {
      const puntaX = this.x + sentido * longitudFlechaPx;
      this.grafico.lineBetween(this.x, this.y, puntaX, this.y);
      const dirCabeza = -sentido;
      this.grafico.lineBetween(puntaX, this.y, puntaX + dirCabeza * 8, this.y - 6);
      this.grafico.lineBetween(puntaX, this.y, puntaX + dirCabeza * 8, this.y + 6);
    } else {
      // Deriva cero: un punto quieto en vez de una flecha sin sentido.
      this.grafico.fillStyle(0xffcc55, 1);
      this.grafico.fillCircle(this.x, this.y, 4);
    }

    this.texto.setText(etiqueta);

    // this.texto.width ya refleja el ancho real tras el wordWrap (la línea
    // más larga de las que Phaser partió), en las mismas unidades internas
    // que this.x -- se deshace la compensación de escala para devolver
    // bordes en CSS px, la unidad en la que mide el e2e sobre el viewport
    // real.
    const anchoEtiquetaCssPx = this.texto.width / this.compensacionEscala;
    const etiquetaBordeIzquierdoCssPx = this.xCss - anchoEtiquetaCssPx / 2;
    const etiquetaBordeDerechoCssPx = this.xCss + anchoEtiquetaCssPx / 2;

    return { valorMundo, etiqueta, sentido, longitudFlechaPx, etiquetaBordeIzquierdoCssPx, etiquetaBordeDerechoCssPx };
  }
}
