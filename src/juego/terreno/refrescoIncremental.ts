import type Phaser from "phaser";
import type { Mascara } from "@/sim/terreno/mascara";
import type { RectanguloSucio } from "@/sim/terreno/huella";
import type { PaletaTerreno } from "@/juego/paleta";
import { ANCHO_BORDE_QUEMADO_PX } from "@/juego/terreno/clasificacionVisual";

// Rectángulo realmente repintable: el sucio de la huella más la banda del
// borde quemado, recortado a la máscara. La banda cae FUERA del hueco que
// devuelve la huella (sus píxeles pasan de roca a borde-quemado sin cambiar
// de material), así que sin ampliarlo se quedarían con el color de roca.
export function rectanguloARepintar(mascara: Mascara, sucio: RectanguloSucio): RectanguloSucio | null {
  if (sucio.ancho <= 0 || sucio.alto <= 0) {
    return null;
  }
  const minX = Math.max(0, sucio.x - ANCHO_BORDE_QUEMADO_PX);
  const minY = Math.max(0, sucio.y - ANCHO_BORDE_QUEMADO_PX);
  const maxX = Math.min(mascara.ancho - 1, sucio.x + sucio.ancho - 1 + ANCHO_BORDE_QUEMADO_PX);
  const maxY = Math.min(mascara.alto - 1, sucio.y + sucio.alto - 1 + ANCHO_BORDE_QUEMADO_PX);
  if (maxX < minX || maxY < minY) {
    return null;
  }
  return { x: minX, y: minY, ancho: maxX - minX + 1, alto: maxY - minY + 1 };
}

// Un único ImageData del rectángulo y un único putImageData: el coste del
// refresco queda proporcional al rectángulo y no se lee nada del lienzo
// (la causa del parón era textura.update(), que lee el mapa entero tras cada
// impacto). `colorEn` devuelve null para el aire.
export function pintarRectangulo(
  textura: Phaser.Textures.CanvasTexture,
  rect: RectanguloSucio,
  colorEn: (x: number, y: number) => PaletaTerreno | null,
): void {
  const contexto = textura.context;
  const imagen = contexto.createImageData(rect.ancho, rect.alto);
  for (let dy = 0; dy < rect.alto; dy++) {
    for (let dx = 0; dx < rect.ancho; dx++) {
      const color = colorEn(rect.x + dx, rect.y + dy);
      if (color === null) {
        continue;
      }
      const base = (dy * rect.ancho + dx) * 4;
      imagen.data[base] = color.r;
      imagen.data[base + 1] = color.g;
      imagen.data[base + 2] = color.b;
      imagen.data[base + 3] = 255;
    }
  }
  contexto.putImageData(imagen, rect.x, rect.y);
}

// Cola de subida a la GPU: varias detonaciones del mismo frame (el Racimo
// son cinco) dejan el lienzo 2D al día al instante, que es barato, pero la
// subida de la textura -- lo caro -- se hace UNA vez, en vaciar(), que la
// escena llama al final del frame. Así el destello sale antes que el repintado.
export class ColaRefresco {
  private pendiente = false;

  constructor(private readonly textura: Phaser.Textures.CanvasTexture) {}

  marcar(): void {
    this.pendiente = true;
  }

  descartar(): void {
    this.pendiente = false;
  }

  vaciar(): boolean {
    if (!this.pendiente) {
      return false;
    }
    this.pendiente = false;
    this.textura.refresh();
    return true;
  }
}
