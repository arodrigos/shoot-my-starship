import Phaser from "phaser";
import { comprobarCantidadDentroDelTecho, crearEmisorRegistrado } from "@/juego/efectos/crearEmisorRegistrado";
import {
  DANIO_REFERENCIA_ESCALA_MAXIMA,
  escalaDeDanio,
  planificarExplosion,
  PresupuestoParticulas,
  techoGlobalDeParticulas,
} from "@/juego/efectos/planExplosion";
import type { Detonacion } from "@/sim/partida/detonaciones";

// La escala por daño y su referencia viven en planExplosion.ts (pura, sin
// Phaser); se reexportan para no mover a los que ya las importan de aquí.
export { DANIO_REFERENCIA_ESCALA_MAXIMA, escalaDeDanio };

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
  // Lo que se pintó de verdad (no lo que se pidió): es lo que lee el debug.
  readonly radioOnda: number;
  readonly particulas: number;
  readonly sobre: Detonacion["sobre"];
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
  private presupuestoParticulas: PresupuestoParticulas | null = null;

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

  // `cssPorUnidad` y `movimientoReducido` los decide la escena (son del
  // viewport, no de la explosión); aquí solo se dibuja el plan.
  reproducir(detonacion: Detonacion, cssPorUnidad: number, movimientoReducido: boolean): DatosExplosionPorCapas {
    const { x, y } = detonacion;
    const ahoraMs = this.escena.time.now;
    const plan = planificarExplosion({
      detonacion,
      cssPorUnidad,
      movimientoReducido,
      particulasConcedibles: (pedidas, duracionMs) => this.presupuesto().reservar(ahoraMs, pedidas, duracionMs),
      cantidadMaxEscombros: CANTIDAD_ESCOMBROS,
      cantidadMaxHumo: CANTIDAD_HUMO,
    });

    // Capa 1, destello: un disco que se abre y se apaga casi al instante.
    const destello = this.escena.add.circle(x, y, 4, 0xfff2c0, 0.9);
    destello.setDepth(50);
    this.escena.tweens.add({
      targets: destello,
      radius: plan.radioDestello,
      alpha: 0,
      duration: plan.duracionDestelloMs,
      onComplete: () => destello.destroy(),
    });

    // Capa 2, onda de choque: termina EXACTAMENTE en el radio de efecto, así
    // que enseña el área que de verdad hace daño. Con movimiento reducido es
    // un anillo ya en su radio final que solo se desvanece.
    const radioInicialOnda = movimientoReducido ? plan.radioOnda : Math.min(6, plan.radioOnda);
    const onda = this.escena.add.circle(x, y, radioInicialOnda, 0xffffff, 0);
    onda.setStrokeStyle(plan.trazoOnda, 0xffe9a8, 0.9);
    onda.setDepth(49);
    this.escena.tweens.add({
      targets: onda,
      radius: plan.radioOnda,
      duration: plan.duracionOndaMs,
      onUpdate: (tween: Phaser.Tweens.Tween) => onda.setStrokeStyle(plan.trazoOnda, 0xffe9a8, 0.9 * (1 - tween.progress)),
      onComplete: () => onda.destroy(),
    });

    // Realce de una detonación que daña a una nave: un segundo anillo rojo,
    // para que no se lea igual que una sobre el vacío.
    if (plan.realce) {
      const realce = this.escena.add.circle(x, y, plan.radioDestello * 0.6, 0xff4d4d, 0.5);
      realce.setDepth(51);
      this.escena.tweens.add({
        targets: realce,
        alpha: 0,
        duration: plan.duracionDestelloMs,
        onComplete: () => realce.destroy(),
      });
    }

    // Capas 3 y 4: la cantidad ya viene recortada por el presupuesto global.
    if (plan.escombros > 0) {
      comprobarCantidadDentroDelTecho("escombros-impacto", plan.escombros);
      this.emisorEscombros.setPosition(x, y);
      this.emisorEscombros.explode(plan.escombros, x, y);
    }
    if (plan.humo > 0) {
      comprobarCantidadDentroDelTecho("humo-residual", plan.humo);
      this.emisorHumo.setPosition(x, y);
      this.emisorHumo.explode(plan.humo, x, y);
    }

    // Capa 5, marca persistente en el terreno: a diferencia de las otras
    // cuatro, esta NO se destruye sola -- se queda como huella del impacto
    // hasta que el techo de objetos vivos obliga a reciclar la más antigua.
    if (!movimientoReducido) {
      const marca = this.escena.add.circle(x, y, 10 + 14 * plan.escala, 0x1a1208, 0.35);
      marca.setDepth(1);
      this.marcasTerreno.push(marca);
      if (this.marcasTerreno.length > TECHO_MARCAS_TERRENO) {
        this.marcasTerreno.shift()!.destroy();
      }
    }

    return {
      x,
      y,
      danio: detonacion.danioAplicado,
      escala: plan.escala,
      inicioMs: ahoraMs,
      radioOnda: plan.radioOnda,
      particulas: plan.escombros + plan.humo,
      sobre: detonacion.sobre,
    };
  }

  // Se crea al primer uso: el ancho del viewport solo se conoce ya con el
  // lienzo montado, y no cambia durante la partida.
  private presupuesto(): PresupuestoParticulas {
    this.presupuestoParticulas ??= new PresupuestoParticulas(techoGlobalDeParticulas(window.innerWidth));
    return this.presupuestoParticulas;
  }
}
