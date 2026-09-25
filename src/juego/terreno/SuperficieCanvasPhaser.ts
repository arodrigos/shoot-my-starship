import type Phaser from "phaser";
import { esSolido, type Mascara } from "@/sim/terreno/mascara";
import type { RectanguloSucio } from "@/sim/terreno/huella";
import type { SuperficieDeTerreno } from "@/juego/terreno/Terreno";
import type { PaletaTerreno } from "@/juego/paleta";
import { PALETA_PROVISIONAL } from "@/juego/paleta";

// Implementación de SuperficieDeTerreno sobre una CanvasTexture de Phaser.
// La paleta llega por parámetro (render-juego, sustituye el color cableado
// que tenía este módulo en terreno-mascara): sólido y aire siguen
// distinguiéndose por alfa, que es lo único que terreno-3 comprueba, pero
// ahora el color de "sólido" lo decide el mapa, no este fichero.
export class SuperficieCanvasPhaser implements SuperficieDeTerreno {
  constructor(
    private readonly textura: Phaser.Textures.CanvasTexture,
    private readonly paleta: PaletaTerreno = PALETA_PROVISIONAL,
  ) {}

  // Refresco incremental (un impacto): SOLO fillRect/clearRect, nunca
  // getImageData ni putImageData (terreno-6) -- este es el camino que se
  // ejecuta cada vez que un arma toca el terreno, y es justo el que el
  // criterio no quiere ver tocando el canvas por lectura/escritura de
  // píxeles a granel. Comprime cada fila en tramos contiguos del mismo
  // valor para no pintar píxel a píxel.
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
        const solido = esSolido(mascara, x, y);
        const inicioTramo = x;
        while (x + 1 <= maxX && esSolido(mascara, x + 1, y) === solido) {
          x++;
        }
        const anchoTramo = x - inicioTramo + 1;
        if (solido) {
          contexto.fillStyle = `rgb(${this.paleta.r}, ${this.paleta.g}, ${this.paleta.b})`;
          contexto.fillRect(inicioTramo, y, anchoTramo, 1);
        } else {
          contexto.clearRect(inicioTramo, y, anchoTramo, 1);
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

    for (let i = 0; i < mascara.datos.length; i++) {
      const base = i * 4;
      if (mascara.datos[i] === 1) {
        imagen.data[base] = this.paleta.r;
        imagen.data[base + 1] = this.paleta.g;
        imagen.data[base + 2] = this.paleta.b;
        imagen.data[base + 3] = 255;
      } else {
        imagen.data[base + 3] = 0;
      }
    }

    contexto.putImageData(imagen, 0, 0);
    this.textura.update();
  }
}
