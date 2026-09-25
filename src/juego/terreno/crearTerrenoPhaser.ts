import type Phaser from "phaser";
import type { Mascara } from "@/sim/terreno/mascara";
import { Terreno } from "@/juego/terreno/Terreno";
import { SuperficieCanvasPhaser } from "@/juego/terreno/SuperficieCanvasPhaser";
import type { PaletaTerreno } from "@/juego/paleta";
import { PALETA_PROVISIONAL } from "@/juego/paleta";

export interface TerrenoPhaser {
  readonly terreno: Terreno;
  readonly superficie: SuperficieCanvasPhaser;
  readonly imagen: Phaser.GameObjects.Image;
}

// Crea la CanvasTexture de Phaser del tamaño de la máscara, la pinta con el
// estado inicial y la añade a la escena como imagen en (0,0). Es el único
// sitio que sabe que el terreno "es" una CanvasTexture -- el resto del
// juego solo conoce la interfaz Terreno.
export function crearTerrenoPhaser(
  escena: Phaser.Scene,
  mascara: Mascara,
  claveTextura: string,
  paleta: PaletaTerreno = PALETA_PROVISIONAL,
): TerrenoPhaser {
  const textura = escena.textures.createCanvas(claveTextura, mascara.ancho, mascara.alto);
  if (textura === null) {
    throw new Error(`No se pudo crear la textura de terreno "${claveTextura}"`);
  }

  const superficie = new SuperficieCanvasPhaser(textura, paleta);
  superficie.pintarCompleta(mascara);

  const imagen = escena.add.image(0, 0, claveTextura).setOrigin(0, 0);
  const terreno = new Terreno(mascara, superficie);

  return { terreno, superficie, imagen };
}
