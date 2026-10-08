import type Phaser from "phaser";
import { AIRE, type Mascara } from "@/sim/terreno/mascara";
import type { RectanguloSucio } from "@/sim/terreno/huella";
import type { SuperficieDeTerreno } from "@/juego/terreno/Terreno";
import type { PaletaTerreno } from "@/juego/paleta";
import { FACTOR_BORDE_QUEMADO, PALETA_ESPACIO_ESCOMBRO, PALETA_PROVISIONAL, oscurecer } from "@/juego/paleta";
import { clasificarPixelVisual, type TipoVisualPixel } from "@/juego/terreno/clasificacionVisual";
import { ColaRefresco, pintarRectangulo, rectanguloARepintar } from "@/juego/terreno/refrescoIncremental";

// Implementación de SuperficieDeTerreno sobre una CanvasTexture de Phaser.
// La paleta llega por parámetro (render-juego, sustituye el color cableado
// que tenía este módulo en terreno-mascara): sólido y aire siguen
// distinguiéndose por alfa, que es lo único que terreno-3 comprueba, pero
// ahora el color de "sólido" lo decide el mapa, no este fichero.
export class SuperficieCanvasPhaser implements SuperficieDeTerreno {
  private readonly colorRoca: PaletaTerreno;
  private readonly colorBordeQuemado: PaletaTerreno;

  private readonly cola: ColaRefresco;

  constructor(
    private readonly textura: Phaser.Textures.CanvasTexture,
    private readonly paleta: PaletaTerreno = PALETA_PROVISIONAL,
  ) {
    this.cola = new ColaRefresco(textura);
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

  // Refresco incremental (un impacto): ImageData del rectángulo sucio y un
  // putImageData, sin leer el lienzo (terreno-6) ni llamar a update(), que
  // hace getImageData del mapa entero. La subida a la GPU va en vaciarCola.
  refrescarRectangulo(mascara: Mascara, rectangulo: RectanguloSucio): void {
    const rect = rectanguloARepintar(mascara, rectangulo);
    if (rect === null) {
      return;
    }
    pintarRectangulo(this.textura, rect, (x, y) => {
      const tipo = clasificarPixelVisual(mascara, x, y);
      return tipo === "aire" ? null : this.colorDe(tipo);
    });
    this.cola.marcar();
  }

  vaciarCola(): boolean {
    return this.cola.vaciar();
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
    this.cola.descartar();
    this.textura.update();
  }
}
