import type Phaser from "phaser";
import type { Mascara } from "@/sim/terreno/mascara";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { Terreno } from "@/juego/terreno/Terreno";
import { SuperficieEspacio, type GeometriaPlaneta } from "@/juego/terreno/SuperficieEspacio";

export interface TerrenoEspacioPhaser {
  readonly terreno: Terreno;
  readonly superficie: SuperficieEspacio;
  readonly imagen: Phaser.GameObjects.Image;
}

// Análogo a crearTerrenoPhaser.ts (render-juego) para el hito espacial: la
// única diferencia real es la superficie (SuperficieEspacio en vez de
// SuperficieCanvasPhaser) y que necesita la geometría fija de cada planeta
// para poder sombrearlo -- generarSistema ya la trae en `planetas` (cx, cy,
// radio), así que aquí solo se reempaqueta en el mapa que pide el
// constructor.
export function crearTerrenoEspacioPhaser(
  escena: Phaser.Scene,
  mascara: Mascara,
  claveTextura: string,
  planetas: RegistroPlanetas,
): TerrenoEspacioPhaser {
  const textura = escena.textures.createCanvas(claveTextura, mascara.ancho, mascara.alto);
  if (textura === null) {
    throw new Error(`No se pudo crear la textura de terreno "${claveTextura}"`);
  }

  const geometrias = new Map<number, GeometriaPlaneta>(
    planetas.map((planeta) => [planeta.id, { cx: planeta.cx, cy: planeta.cy, radio: planeta.radio }]),
  );

  const superficie = new SuperficieEspacio(textura, geometrias);
  superficie.pintarCompleta(mascara);

  const imagen = escena.add.image(0, 0, claveTextura).setOrigin(0, 0);
  const terreno = new Terreno(mascara, superficie);

  return { terreno, superficie, imagen };
}
