import Phaser from "phaser";

// Referencia de escala visual: los mapas del catálogo se mueven en
// +-30 px/s² aprox., así que una deriva de esta magnitud ya llena la flecha
// entera -- por encima de esto se satura, no se sale del HUD.
const DERIVA_REFERENCIA_PX_S2 = 30;
const LONGITUD_MAXIMA_PX = 70;
const LONGITUD_MINIMA_VISIBLE_PX = 6;

export interface EstadoDerivaDibujado {
  readonly valorMundo: number;
  readonly etiqueta: string;
  readonly sentido: -1 | 0 | 1;
  readonly longitudFlechaPx: number;
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

  constructor(escena: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.grafico = escena.add.graphics().setScrollFactor(0).setDepth(100);
    this.texto = escena.add
      .text(x, y + 18, "", { fontSize: "16px", color: "#f2f2f2" })
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

    return { valorMundo, etiqueta, sentido, longitudFlechaPx };
  }
}
