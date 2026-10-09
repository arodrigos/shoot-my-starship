import Phaser from "phaser";
import { aspectoDeId, aspectosDelCatalogo, nombreTextura, radioEnvolvente, type AspectoArma } from "@/juego/armas/aspecto";

// Margen de la textura horneada para que el borde y la sombra no se corten.
const MARGEN_TEXTURA_PX = 3;
const ESCALA_REPOSO = 0.75;
const PROFUNDIDAD_VUELO = 50;
const PROFUNDIDAD_REPOSO = 31;

export interface MuestraProyectil {
  readonly armaId: string;
  readonly textura: string;
  readonly rotacion: number;
  readonly rumbo: number;
  readonly particulasEstela: number;
}

export interface EmisoresEstela {
  readonly llama: Phaser.GameObjects.Particles.ParticleEmitter;
  readonly humo: Phaser.GameObjects.Particles.ParticleEmitter;
}

// Capa de cáscara del arma: hornea una textura por arma al precalentar la
// escena (una sola vez, nunca por disparo) y la mueve como Image. La forma sale
// de aspecto.ts, la misma entrada que el icono SVG del selector.
export class VisualArmas {
  private readonly vuelo: Phaser.GameObjects.Image;
  private readonly reposo: Phaser.GameObjects.Image;
  private giroAcumulado = 0;
  private armaEnVuelo: string | null = null;
  private muestra: MuestraProyectil | null = null;
  private armaReposo: { armaId: string; rotacion: number } | null = null;

  constructor(
    private readonly escena: Phaser.Scene,
    private readonly emisores: EmisoresEstela,
  ) {
    this.hornear();
    const primera = nombreTextura(aspectosDelCatalogo()[0].armaId);
    this.vuelo = escena.add.image(0, 0, primera).setVisible(false).setDepth(PROFUNDIDAD_VUELO);
    this.reposo = escena.add.image(0, 0, primera).setVisible(false).setDepth(PROFUNDIDAD_REPOSO).setScale(ESCALA_REPOSO);
  }

  // También se llama tras perder el contexto WebGL: las texturas se vuelven a
  // generar desde la definición.
  hornear(): void {
    for (const aspecto of aspectosDelCatalogo()) {
      const nombre = nombreTextura(aspecto.armaId);
      if (this.escena.textures.exists(nombre)) this.escena.textures.remove(nombre);
      this.dibujar(aspecto, nombre);
    }
  }

  private dibujar(aspecto: AspectoArma, nombre: string): void {
    const radio = Math.ceil(radioEnvolvente(aspecto.puntos)) + MARGEN_TEXTURA_PX;
    const lado = radio * 2;
    const g = this.escena.make.graphics({ x: 0, y: 0 }, false);
    const trasladar = (puntos: readonly { x: number; y: number }[], k = 1, dx = 0, dy = 0) =>
      puntos.map((p) => new Phaser.Math.Vector2(radio + p.x * k + dx, radio + p.y * k + dy));
    const { paleta, puntos } = aspecto;
    g.fillStyle(0x000000, 0.35);
    g.fillPoints(trasladar(puntos, 1, 1.5, 1.5), true);
    g.fillStyle(paleta.cuerpo, 1);
    g.fillPoints(trasladar(puntos), true);
    // Brillo: la misma silueta más pequeña y desplazada hacia arriba, como una
    // luz cenital; da volumen sin sombreado por píxel.
    g.fillStyle(paleta.brillo, 0.45);
    g.fillPoints(trasladar(puntos, 0.5, 0, -radio * 0.12), true);
    g.lineStyle(1.5, paleta.borde, 1);
    g.strokePoints(trasladar(puntos), true, true);
    g.generateTexture(nombre, lado, lado);
    g.destroy();
  }

  // Cada fotograma de un vuelo real. `reducido` quita estela y giro.
  actualizarVuelo(armaId: string, x: number, y: number, rumbo: number, deltaMs: number, reducido: boolean): MuestraProyectil {
    const aspecto = aspectoDeId(armaId);
    if (this.armaEnVuelo !== armaId) {
      this.armaEnVuelo = armaId;
      this.giroAcumulado = 0;
    }
    if (!reducido) this.giroAcumulado += (aspecto.giroRadS * deltaMs) / 1000;
    const rotacion = rumbo + this.giroAcumulado;
    const textura = nombreTextura(aspecto.armaId);
    this.vuelo.setTexture(textura).setPosition(x, y).setRotation(rotacion).setVisible(true);
    if (!reducido && aspecto.estela !== "ninguna") {
      const emisor = aspecto.estela === "llama" ? this.emisores.llama : this.emisores.humo;
      emisor.setParticleTint(aspecto.estela === "llama" ? aspecto.paleta.estela : 0x9a9a9a);
      emisor.emitParticleAt(x, y, 1);
    }
    this.muestra = {
      armaId,
      textura,
      rotacion,
      rumbo,
      particulasEstela: this.emisores.llama.getAliveParticleCount() + this.emisores.humo.getAliveParticleCount(),
    };
    return this.muestra;
  }

  ocultarVuelo(): void {
    this.vuelo.setVisible(false);
  }

  finDeVuelo(): void {
    this.armaEnVuelo = null;
    this.muestra = null;
    this.vuelo.setVisible(false);
  }

  ultimaMuestra(): MuestraProyectil | null {
    return this.muestra;
  }

  // El arma elegida, montada en el lanzador y orientada con el ángulo.
  mostrarReposo(armaId: string, x: number, y: number, rotacion: number): void {
    this.reposo.setTexture(nombreTextura(aspectoDeId(armaId).armaId)).setPosition(x, y).setRotation(rotacion).setVisible(true);
    this.armaReposo = { armaId, rotacion };
  }

  ocultarReposo(): void {
    this.reposo.setVisible(false);
    this.armaReposo = null;
  }

  enReposo(): { armaId: string; rotacion: number } | null {
    return this.armaReposo;
  }

  // Fogonazo breve en el morro. Es un círculo con tween, no partículas, para no
  // gastar presupuesto.
  fogonazo(x: number, y: number, color: number): void {
    const destello = this.escena.add.circle(x, y, 7, color, 0.9).setDepth(PROFUNDIDAD_VUELO + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.escena.tweens.add({
      targets: destello,
      scale: 2.2,
      alpha: 0,
      duration: 130,
      onComplete: () => destello.destroy(),
    });
  }
}
