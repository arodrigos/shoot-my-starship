import Phaser from "phaser";
import { RADIO_ENVOLVENTE_NAVE_PX, SEMIALTO_MAXIMO_NAVE_PX } from "@/sim/naves/geometriaCasco";

export const ALFA_FANTASMA = 0.4;
const AMPLITUD_VAIVEN_U = 4;
const PERIODO_VAIVEN_MS = 2400;
const TAMANO_NOMBRE_PX = 34;
const MARGEN_TEXTURA_U = 4;
// Mezcla con gris: el fantasma conserva la pista del asiento sin competir con
// las naves vivas, que van a color pleno.
const FRACCION_GRIS = 0.55;
const GRIS = 0xc4c8d0;

export function desaturarColor(color: number): number {
  const mezcla = (canal: number, gris: number): number => Math.round(canal * (1 - FRACCION_GRIS) + gris * FRACCION_GRIS);
  const r = mezcla((color >> 16) & 0xff, (GRIS >> 16) & 0xff);
  const g = mezcla((color >> 8) & 0xff, (GRIS >> 8) & 0xff);
  const b = mezcla(color & 0xff, GRIS & 0xff);
  return (r << 16) | (g << 8) | b;
}

export interface DatosFantasma {
  readonly idNave: number;
  readonly nombre: string;
  readonly color: number;
  readonly puntos: readonly { readonly x: number; readonly y: number }[];
  readonly x: number;
  readonly y: number;
  readonly movimientoReducido: boolean;
}

// La misma silueta que colisionaba en vida, horneada a una textura propia:
// un Image es un solo quad, y generateTexture mantiene el lienzo de origen,
// con lo que Phaser la vuelve a subir sola al restaurar el contexto WebGL.
export class FantasmaNave {
  readonly idNave: number;
  readonly nombre: string;
  readonly claveTextura: string;
  private readonly imagen: Phaser.GameObjects.Image;
  private readonly texto: Phaser.GameObjects.Text;
  private readonly baseY: number;
  private readonly tween?: Phaser.Tweens.Tween;

  constructor(
    private readonly escena: Phaser.Scene,
    datos: DatosFantasma,
  ) {
    this.idNave = datos.idNave;
    this.nombre = datos.nombre;
    this.baseY = datos.y;
    this.claveTextura = `fantasma-nave-${datos.idNave}`;

    const lado = Math.ceil(2 * (RADIO_ENVOLVENTE_NAVE_PX + MARGEN_TEXTURA_U));
    const centro = lado / 2;
    if (escena.textures.exists(this.claveTextura)) escena.textures.remove(this.claveTextura);
    const g = escena.make.graphics({ x: 0, y: 0 }, false);
    const tinte = desaturarColor(datos.color);
    const puntos = datos.puntos.map((p) => new Phaser.Math.Vector2(p.x + centro, p.y + centro));
    g.fillStyle(tinte, 1).fillPoints(puntos, true);
    g.lineStyle(2, 0xffffff, 1).strokePoints(puntos, true, true);
    g.generateTexture(this.claveTextura, lado, lado);
    g.destroy();

    this.imagen = escena.add.image(datos.x, datos.y, this.claveTextura).setAlpha(ALFA_FANTASMA).setDepth(20);
    // Phaser.Text pinta el nombre como glifos de un lienzo: ningún valor
    // escrito por el jugador llega a interpretarse como HTML.
    this.texto = escena.add
      .text(datos.x, datos.y - SEMIALTO_MAXIMO_NAVE_PX - 10, datos.nombre, {
        fontSize: `${TAMANO_NOMBRE_PX}px`,
        color: "#ffffff",
        stroke: "#0b1a2b",
        strokeThickness: 5,
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.85)
      .setDepth(21);

    if (!datos.movimientoReducido) {
      this.tween = escena.tweens.add({
        targets: [this.imagen, this.texto],
        y: `-=${AMPLITUD_VAIVEN_U}`,
        duration: PERIODO_VAIVEN_MS / 2,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  obtenerAlfa(): number {
    return this.imagen.alpha;
  }

  obtenerPosicion(): { x: number; y: number } {
    return { x: this.imagen.x, y: this.baseY };
  }

  obtenerYVisible(): number {
    return this.imagen.y;
  }

  texturaValida(): boolean {
    return this.escena.textures.exists(this.claveTextura) && this.imagen.texture.key === this.claveTextura;
  }

  destruir(): void {
    this.tween?.remove();
    this.imagen.destroy();
    this.texto.destroy();
    if (this.escena.textures.exists(this.claveTextura)) this.escena.textures.remove(this.claveTextura);
  }
}
