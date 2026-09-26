import Phaser from "phaser";
import { ALTO_CASCO, ANCHO_CASCO, LARGO_CANON, puntosCasco } from "@/juego/naves/geometriaCasco";

const COLOR_NAVE_0 = 0x5ac8fa;
const COLOR_NAVE_1 = 0xff6b4a;
const COLOR_CASCO_SOMBRA = 0x1c1e24;
const COLOR_PATAS = 0x3a3d46;
const COLOR_CANON = 0xd9dbe0;

// Nave varada vectorial (silueta, patas y cañón torcido): nada de sprites
// bitmap, para que cambiar de paleta o de forma sea cambiar números, no
// encargar arte. El "torcido" es la forma del cañón (dos tramos con un
// quiebro), no su puntería -- eso lo decide anguloGrados.
export class Nave {
  private readonly contenedor: Phaser.GameObjects.Container;
  private readonly casco: Phaser.GameObjects.Graphics;
  private readonly canon: Phaser.GameObjects.Graphics;
  private anguloActualGrados: number;

  constructor(
    escena: Phaser.Scene,
    private readonly idNave: 0 | 1,
    x: number,
    groundY: number,
    private readonly mirarHaciaMasX: boolean,
    anguloInicialGrados: number,
  ) {
    this.anguloActualGrados = anguloInicialGrados;
    this.contenedor = escena.add.container(x, groundY);

    const colorCasco = idNave === 0 ? COLOR_NAVE_0 : COLOR_NAVE_1;
    const dir = mirarHaciaMasX ? 1 : -1;

    // Patas: dos apoyos asimétricos, como si la nave hubiese aterrizado mal
    // -- "varada", no aparcada. Nacen en el borde inferior real del casco
    // (0.32 * ALTO_CASCO, ver geometriaCasco.puntosCasco), no en el origen
    // del contenedor -- desde impacto-naves el origen es el CENTRO del
    // casco, no sus patas.
    const yBordeInferiorCasco = 0.32 * ALTO_CASCO;
    const patas = escena.add.graphics();
    patas.lineStyle(4, COLOR_PATAS, 1);
    patas.lineBetween(-ANCHO_CASCO * 0.3, yBordeInferiorCasco, -ANCHO_CASCO * 0.4, yBordeInferiorCasco + 10);
    patas.lineBetween(ANCHO_CASCO * 0.25, yBordeInferiorCasco, ANCHO_CASCO * 0.15, yBordeInferiorCasco + 12);
    this.contenedor.add(patas);

    // Casco: silueta poligonal simple (fuselaje + aleta), con una sombra
    // desplazada para que se lea como volumen sin usar ninguna textura.
    this.casco = escena.add.graphics();
    this.dibujarCasco(colorCasco, dir);
    this.contenedor.add(this.casco);

    // Cañón: dos tramos con un quiebro a mitad de camino -- el "cañón
    // torcido" del diseño. Se redibuja cada vez que cambia el ángulo.
    this.canon = escena.add.graphics();
    this.contenedor.add(this.canon);
    this.apuntar(anguloInicialGrados);
  }

  private dibujarCasco(color: number, dir: 1 | -1): void {
    const puntos = puntosCasco(dir).map((p) => new Phaser.Math.Vector2(p.x, p.y));
    this.casco.fillStyle(COLOR_CASCO_SOMBRA, 1);
    this.casco.fillPoints(
      puntos.map((p) => new Phaser.Math.Vector2(p.x + 2, p.y + 2)),
      true,
    );
    this.casco.fillStyle(color, 1);
    this.casco.fillPoints(puntos, true);
  }

  // Dibuja el cañón con un quiebro visual apuntando a anguloGrados (misma
  // convención que EntradaDeTurno: 0 = +x, 90 = vertical, 180 = -x). El
  // vector se calcula directamente en vez de usar `.rotation` de Phaser
  // para no tener que razonar sobre su signo de giro en cada lectura.
  apuntar(anguloGrados: number): void {
    this.anguloActualGrados = anguloGrados;
    const rad = (anguloGrados * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = -Math.sin(rad);
    const origenX = 0;
    // 0.3 (antes 0.6 sobre el ALTO_CASCO de antes de impacto-naves, la
    // mitad al doblarse ALTO_CASCO): mismo punto de montaje absoluto del
    // cañón respecto al casco, ahora que el origen del contenedor es su
    // centro y no su base.
    const origenY = -ALTO_CASCO * 0.3;
    const quiebroX = origenX + dx * LARGO_CANON * 0.55;
    const quiebroY = origenY + dy * LARGO_CANON * 0.55;
    // El quiebro se desplaza perpendicular al eje del cañón, siempre el
    // mismo lado relativo: es lo que lo hace leerse como "torcido" y no
    // como temblor aleatorio.
    const perpX = -dy * 4;
    const perpY = dx * 4;
    const puntaX = origenX + dx * LARGO_CANON;
    const puntaY = origenY + dy * LARGO_CANON;

    this.canon.clear();
    this.canon.lineStyle(6, COLOR_CANON, 1);
    this.canon.beginPath();
    this.canon.moveTo(origenX, origenY);
    this.canon.lineTo(quiebroX + perpX, quiebroY + perpY);
    this.canon.lineTo(puntaX, puntaY);
    this.canon.strokePath();
  }

  obtenerAnguloActual(): number {
    return this.anguloActualGrados;
  }

  // Punto del mundo desde el que sale el proyectil: mismo criterio que
  // ALTURA_CANON_PX en el núcleo (origenY - ALTURA_CANON_PX), para que la
  // animación arranque exactamente donde arranca la física real.
  obtenerPosicionCanon(): { x: number; y: number } {
    const rad = (this.anguloActualGrados * Math.PI) / 180;
    const origenY = -ALTO_CASCO * 0.3;
    return {
      x: this.contenedor.x + Math.cos(rad) * LARGO_CANON,
      y: this.contenedor.y + origenY - Math.sin(rad) * LARGO_CANON,
    };
  }

  posicionarEn(x: number, groundY: number): void {
    this.contenedor.setPosition(x, groundY);
  }

  // Atenúa el casco con la integridad restante: en 0 se ve claramente
  // fuera de combate sin necesitar un sprite de "destruida" aparte.
  actualizarIntegridad(integridad: number): void {
    const alfa = 0.35 + 0.65 * Math.max(0, Math.min(100, integridad)) / 100;
    this.casco.setAlpha(alfa);
  }

  obtenerId(): 0 | 1 {
    return this.idNave;
  }
}
