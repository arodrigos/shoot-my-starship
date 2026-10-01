import type Phaser from "phaser";
import { AIRE, type Mascara } from "@/sim/terreno/mascara";
import type { RectanguloSucio } from "@/sim/terreno/huella";
import type { SuperficieDeTerreno } from "@/juego/terreno/Terreno";
import type { PaletaTerreno } from "@/juego/paleta";
import { FACTOR_BORDE_QUEMADO, PALETA_ESPACIO_ESCOMBRO, PALETA_PROVISIONAL, oscurecer } from "@/juego/paleta";
import { clasificarPixelVisual, type TipoVisualPixel } from "@/juego/terreno/clasificacionVisual";

// Implementación de SuperficieDeTerreno sobre una CanvasTexture de Phaser.
// La paleta llega por parámetro (render-juego, sustituye el color cableado
// que tenía este módulo en terreno-mascara): sólido y aire siguen
// distinguiéndose por alfa, que es lo único que terreno-3 comprueba, pero
// ahora el color de "sólido" lo decide el mapa, no este fichero.
export class SuperficieCanvasPhaser implements SuperficieDeTerreno {
  private readonly colorRoca: PaletaTerreno;
  private readonly colorBordeQuemado: PaletaTerreno;

  constructor(
    private readonly textura: Phaser.Textures.CanvasTexture,
    private readonly paleta: PaletaTerreno = PALETA_PROVISIONAL,
  ) {
    this.colorRoca = paleta;
    this.colorBordeQuemado = oscurecer(paleta, FACTOR_BORDE_QUEMADO);
  }

  // crateres-y-escombros: color por tipo visual, derivado SOLO de la máscara
  // (clasificarPixelVisual) -- nunca al revés. "aire" no se consulta aquí
  // porque refrescarRectangulo y pintarCompleta ya lo tratan aparte
  // (clearRect / alfa 0), igual que antes de este bloque.
  private colorDe(tipo: Exclude<TipoVisualPixel, "aire">): PaletaTerreno {
    if (tipo === "escombro") return PALETA_ESPACIO_ESCOMBRO;
    if (tipo === "borde-quemado") return this.colorBordeQuemado;
    return this.colorRoca;
  }

  // Refresco incremental (un impacto): SOLO fillRect/clearRect, nunca
  // getImageData ni putImageData (terreno-6) -- este es el camino que se
  // ejecuta cada vez que un arma toca el terreno, y es justo el que el
  // criterio no quiere ver tocando el canvas por lectura/escritura de
  // píxeles a granel. Comprime cada fila en tramos contiguos del MISMO tipo
  // visual (no solo sólido/aire, desde crateres-y-escombros) para no pintar
  // píxel a píxel.
  refrescarRectangulo(mascara: Mascara, rectangulo: RectanguloSucio): void {
    if (rectangulo.ancho <= 0 || rectangulo.alto <= 0) {
      return;
    }

    const contexto = this.textura.context;
    const maxX = rectangulo.x + rectangulo.ancho - 1;
    const maxY = rectangulo.y + rectangulo.alto - 1;

    for (let y = rectangulo.y; y <= maxY; y++) {
      let x = rectangulo.x;
      while (x <= maxX) {
        const tipo = clasificarPixelVisual(mascara, x, y);
        const inicioTramo = x;
        while (x + 1 <= maxX && clasificarPixelVisual(mascara, x + 1, y) === tipo) {
          x++;
        }
        const anchoTramo = x - inicioTramo + 1;
        if (tipo === "aire") {
          contexto.clearRect(inicioTramo, y, anchoTramo, 1);
        } else {
          const color = this.colorDe(tipo);
          contexto.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
          contexto.fillRect(inicioTramo, y, anchoTramo, 1);
        }
        x++;
      }
    }

    this.textura.update();
  }

  // Pintado inicial de la máscara entera, al generar el mapa: una pasada de
  // ~2 millones de píxeles para la que fillRect uno a uno sería demasiado
  // lento. Es la única función de este módulo en la LISTA BLANCA de
  // terreno-6 -- getImageData/putImageData aquí están permitidos porque
  // esto no es el camino de refresco por impacto (refrescarRectangulo,
  // arriba) ni el de colisión: se ejecuta una vez, nunca por fotograma.
  pintarCompleta(mascara: Mascara): void {
    const contexto = this.textura.context;
    const imagen = contexto.createImageData(mascara.ancho, mascara.alto);

    for (let y = 0; y < mascara.alto; y++) {
      for (let x = 0; x < mascara.ancho; x++) {
        const i = y * mascara.ancho + x;
        const base = i * 4;
        if (mascara.datos[i] === AIRE) {
          imagen.data[base + 3] = 0;
          continue;
        }
        const tipo = clasificarPixelVisual(mascara, x, y);
        const color = this.colorDe(tipo as Exclude<TipoVisualPixel, "aire">);
        imagen.data[base] = color.r;
        imagen.data[base + 1] = color.g;
        imagen.data[base + 2] = color.b;
        imagen.data[base + 3] = 255;
      }
    }

    contexto.putImageData(imagen, 0, 0);
    this.textura.update();
  }
}
