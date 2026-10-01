import Phaser from "phaser";
import { comprobarCantidadDentroDelTecho, crearEmisorRegistrado } from "@/juego/efectos/crearEmisorRegistrado";

// explosiones-por-capas (exl-1): el daño que más se repite en el catálogo
// (ver src/sim/armas/catalogo.ts) va de 0 a 60 -- 60 es el tope real (Lluvia
// de Chatarra, el arma de submuniciones), así que es la referencia natural
// para la escala del efecto en vez de un número inventado.
export const DANIO_REFERENCIA_ESCALA_MAXIMA = 60;
const ESCALA_MINIMA = 0.35;

// Pura y exportada para que el test unitario la ejerza sin un Phaser.Scene de
// por medio: "proporcional al daño real, no fija" (exl-1) significa que dos
// danios distintos TIENEN que dar dos escalas distintas, nunca la misma.
export function escalaDeDanio(danio: number): number {
  const fraccion = Math.max(0, Math.min(1, danio / DANIO_REFERENCIA_ESCALA_MAXIMA));
  return ESCALA_MINIMA + fraccion * (1 - ESCALA_MINIMA);
}

export interface VentanaFase {
  readonly inicioMs: number;
  readonly finMs: number;
}

export type NombreFaseExplosion = "destello" | "onda" | "escombros" | "humo";

export type VentanasExplosion = Readonly<Record<NombreFaseExplosion, VentanaFase>>;

// Las cuatro capas con sus ventanas de tiempo relativas al instante del
// impacto. Se solapan a propósito (igual que una explosión real: el destello
// no termina antes de que arranque la onda) y NO todas arrancan en el mismo
// instante, que es justo lo que exl-1 pide poder distinguir muestreando en
// instantes concretos.
export const VENTANAS_EXPLOSION: VentanasExplosion = {
  destello: { inicioMs: 0, finMs: 150 },
  onda: { inicioMs: 0, finMs: 500 },
  escombros: { inicioMs: 80, finMs: 900 },
  humo: { inicioMs: 150, finMs: 1500 },
};

// Pura: dado un instante transcurrido desde el impacto, qué capas están
// activas. Determinista por construcción (no depende de temporizadores del
// navegador) -- el e2e y el test unitario llaman exactamente a esta misma
// función, así que nunca hay una ventana de tiempo "a ojo" que falle al azar
// (issue #151): la pregunta siempre es "¿qué capas tocan a los X ms?", nunca
// "¿ya habrá pasado bastante tiempo real?".
export function fasesActivasEn(elapsedMs: number): readonly NombreFaseExplosion[] {
  return (Object.keys(VENTANAS_EXPLOSION) as NombreFaseExplosion[]).filter((nombre) => {
    const ventana = VENTANAS_EXPLOSION[nombre];
    return elapsedMs >= ventana.inicioMs && elapsedMs <= ventana.finMs;
  });
}

export interface DatosExplosionPorCapas {
  readonly x: number;
  readonly y: number;
  readonly danio: number;
  readonly escala: number;
  readonly inicioMs: number;
}

const CANTIDAD_ESCOMBROS = 16;
const CANTIDAD_HUMO = 10;
// exl-2: techo de objetos vivos para la marca persistente -- sin un tope, una
// partida larga con muchos impactos acumularía graphics sin límite. Al
// llegar al techo se recicla el más antiguo en vez de crear uno nuevo.
const TECHO_MARCAS_TERRENO = 8;

// Las cinco capas que pidió el diseño: destello, onda de choque, escombros
// con rebote, humo residual y marca persistente en el terreno. Vive entera
// en src/juego (exl-2): no toca this.estado, no decide daño ni cráter -- solo
// dibuja sobre lo que el núcleo ya resolvió.
export class ExplosionPorCapas {
  private readonly escena: Phaser.Scene;
  private readonly emisorEscombros: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly emisorHumo: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly marcasTerreno: Phaser.GameObjects.Arc[] = [];

  constructor(escena: Phaser.Scene) {
    this.escena = escena;

    const lienzoEscombro = escena.add.graphics();
    lienzoEscombro.fillStyle(0xd9b48c, 1);
    lienzoEscombro.fillRect(0, 0, 3, 3);
    lienzoEscombro.generateTexture("particula-escombro", 3, 3);
    lienzoEscombro.destroy();

    const lienzoHumo = escena.add.graphics();
    lienzoHumo.fillStyle(0x888888, 1);
    lienzoHumo.fillCircle(3, 3, 3);
    lienzoHumo.generateTexture("particula-humo", 6, 6);
    lienzoHumo.destroy();

    this.emisorEscombros = crearEmisorRegistrado(escena, "escombros-impacto", 0, 0, "particula-escombro", {
      speed: { min: 60, max: 220 },
      angle: { min: 0, max: 360 },
      gravityY: 420,
      bounce: 0.4,
      lifespan: 820,
      scale: { start: 1, end: 0.4 },
      alpha: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
      maxParticles: CANTIDAD_ESCOMBROS,
    });

    this.emisorHumo = crearEmisorRegistrado(escena, "humo-residual", 0, 0, "particula-humo", {
      speed: { min: 8, max: 28 },
      angle: { min: 250, max: 290 },
      lifespan: 1350,
      scale: { start: 0.6, end: 2.2 },
      alpha: { start: 0.35, end: 0 },
      quantity: 0,
      emitting: false,
      maxParticles: CANTIDAD_HUMO,
    });
  }

  reproducir(x: number, y: number, danio: number): DatosExplosionPorCapas {
    const escala = escalaDeDanio(danio);

    // Capa 1, destello: un disco que se abre y se apaga casi al instante.
    const destello = this.escena.add.circle(x, y, 10, 0xfff2c0, 0.9);
    destello.setDepth(50);
    this.escena.tweens.add({
      targets: destello,
      radius: 16 + 34 * escala,
      alpha: 0,
      duration: VENTANAS_EXPLOSION.destello.finMs,
      onComplete: () => destello.destroy(),
    });

    // Capa 2, onda de choque: un anillo que crece y se desvanece, más lento
    // y más amplio que el destello para que ambos sean distinguibles en
    // instantes distintos de la misma explosión.
    const onda = this.escena.add.circle(x, y, 6, 0xffffff, 0);
    onda.setStrokeStyle(3, 0xffe9a8, 0.8);
    onda.setDepth(49);
    this.escena.tweens.add({
      targets: onda,
      radius: 20 + 90 * escala,
      duration: VENTANAS_EXPLOSION.onda.finMs,
      onUpdate: () => onda.setStrokeStyle(3, 0xffe9a8, 1 - onda.radius / (20 + 90 * escala)),
      onComplete: () => onda.destroy(),
    });

    // Capa 3, escombros con rebote: un único `.explode()` por impacto, igual
    // que las explosiones existentes (pre-1/pre-2 presupuestan esto barriendo
    // el registro, no hace falta repetir el cálculo aquí).
    const cantidadEscombros = Math.round(CANTIDAD_ESCOMBROS * escala);
    comprobarCantidadDentroDelTecho("escombros-impacto", cantidadEscombros);
    this.emisorEscombros.setPosition(x, y);
    this.emisorEscombros.explode(cantidadEscombros, x, y);

    // Capa 4, humo residual: se queda flotando después de que escombros y
    // onda ya han terminado.
    const cantidadHumo = Math.round(CANTIDAD_HUMO * escala);
    comprobarCantidadDentroDelTecho("humo-residual", cantidadHumo);
    this.emisorHumo.setPosition(x, y);
    this.emisorHumo.explode(cantidadHumo, x, y);

    // Capa 5, marca persistente en el terreno: a diferencia de las otras
    // cuatro, esta NO se destruye sola -- se queda como huella del impacto
    // hasta que el techo de objetos vivos obliga a reciclar la más antigua.
    const marca = this.escena.add.circle(x, y, 10 + 14 * escala, 0x1a1208, 0.35);
    marca.setDepth(1);
    this.marcasTerreno.push(marca);
    if (this.marcasTerreno.length > TECHO_MARCAS_TERRENO) {
      this.marcasTerreno.shift()!.destroy();
    }

    return { x, y, danio, escala, inicioMs: this.escena.time.now };
  }
}
