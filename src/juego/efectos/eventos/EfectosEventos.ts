import type Phaser from "phaser";
import type { DebugEfectoVisible } from "@/debug/tipos";
import { ID_AGUJERO_NEGRO, RADIO_AGUJERO_NEGRO } from "@/sim/universo/efectos";
import type { TipoEvento, EstadoUniverso } from "@/sim/universo/tipos";
import { DURACION_TRANSITORIO_MS, etiquetaDebug, planificarPersistentes, type EfectoPersistente } from "@/juego/efectos/eventos/planEventos";

interface PuntoMundo {
  readonly x: number;
  readonly y: number;
}

interface PozoVisible extends PuntoMundo {
  readonly id: number;
  readonly radio: number;
}

// Lo que la escena le enseña a este módulo en cada refresco: posiciones ya
// resueltas (el núcleo es la única fuente de verdad) y nunca estado de juego.
export interface DatosEventos {
  readonly universo: EstadoUniverso | undefined;
  readonly naves: readonly (PuntoMundo | null)[];
  readonly objetos: readonly (PuntoMundo & { readonly id: number })[];
  readonly planetas: readonly PozoVisible[];
  readonly ancho: number;
  readonly alto: number;
  // Unidades de mundo por píxel CSS, para fijar el icono junto al indicador de deriva.
  readonly mundoPorCss: number;
}

export interface OpcionesEventos {
  readonly reducido: () => boolean;
  readonly sacudidaActiva: () => boolean;
  readonly sacudir: (duracionMs: number, intensidad: number) => void;
  readonly alCambiar: () => void;
}

interface Vivo {
  readonly clave: string;
  readonly plan: EfectoPersistente;
  readonly contenedor: Phaser.GameObjects.Container;
  readonly tweens: Phaser.Tweens.Tween[];
}

interface Transitorio {
  readonly entrada: DebugEfectoVisible;
  readonly objetos: Phaser.GameObjects.GameObject[];
  readonly tweens: Phaser.Tweens.Tween[];
}

const PROFUNDIDAD_AURA = 26;
const PROFUNDIDAD_TRANSITORIO = 1900;
const OFFSET_AURA_NAVE_U = 14;

// Posiciones fijas, derivadas del índice: dibujar un efecto no puede consumir
// ningún azar (ni el de la partida ni Math.random), o la partida dejaría de
// ser reproducible según haya o no efectos activados.
function fraccion(indice: number, sal: number): number {
  const valor = Math.sin(indice * 12.9898 + sal * 78.233) * 43758.5453;
  return valor - Math.floor(valor);
}

// Efectos gráficos de los eventos del universo, uno por tipo y despachados por
// tipo. Los que duran varios turnos se sincronizan contra EstadoUniverso (se
// crean al aparecer y se destruyen al expirar); los instantáneos (lotería,
// reparación, terremoto) viven un rato y se van solos.
export class EfectosEventos {
  private readonly vivos = new Map<string, Vivo>();
  private transitorios: Transitorio[] = [];
  private datos: DatosEventos | null = null;

  constructor(
    private readonly escena: Phaser.Scene,
    private readonly opciones: OpcionesEventos,
  ) {}

  sincronizar(datos: DatosEventos): void {
    this.datos = datos;
    const plan = planificarPersistentes(datos.universo);
    const claves = new Set(plan.map((efecto) => efecto.clave));
    for (const [clave, vivo] of this.vivos) {
      if (claves.has(clave)) continue;
      this.destruirVivo(vivo);
      this.vivos.delete(clave);
    }
    for (const efecto of plan) {
      const existente = this.vivos.get(efecto.clave);
      if (existente === undefined) {
        const nuevo = this.crearVivo(efecto, datos);
        if (nuevo !== null) this.vivos.set(efecto.clave, nuevo);
      } else {
        this.colocar(existente, datos);
      }
    }
    this.opciones.alCambiar();
  }

  // Un evento del núcleo acaba de ocurrir: lanza lo que no vive en el estado.
  disparar(tipo: TipoEvento, nave: number, datos: DatosEventos): void {
    const reducido = this.opciones.reducido();
    if (tipo === "loteria") this.lluviaDeMonedas(nave, datos, reducido);
    else if (tipo === "reparacion") this.barridoDeReparacion(datos, reducido);
    else if (tipo === "terremoto") this.sacudidaYPolvo(datos, reducido);
  }

  destelloCuracion(nave: number, datos: DatosEventos): void {
    const posicion = datos.naves[nave];
    if (!posicion) return;
    const g = this.escena.add.graphics().setDepth(PROFUNDIDAD_TRANSITORIO).setPosition(posicion.x, posicion.y - OFFSET_AURA_NAVE_U);
    g.fillStyle(0x5dff8a, 0.55);
    g.fillCircle(0, 0, 46);
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeCircle(0, 0, 46);
    this.terminarEn(g, 700, this.opciones.reducido() ? null : { alpha: 0, scale: 1.6 });
  }

  descargaTormenta(nave: number, datos: DatosEventos): void {
    const posicion = datos.naves[nave];
    if (!posicion) return;
    const g = this.escena.add.graphics().setDepth(PROFUNDIDAD_TRANSITORIO).setPosition(posicion.x, posicion.y - OFFSET_AURA_NAVE_U);
    g.lineStyle(4, 0xfff27a, 1);
    // Rayo en zigzag desde arriba hasta el casco.
    g.beginPath();
    g.moveTo(-6, -150);
    g.lineTo(10, -100);
    g.lineTo(-8, -60);
    g.lineTo(8, -25);
    g.lineTo(0, 0);
    g.strokePath();
    g.fillStyle(0xfff27a, 0.5);
    g.fillCircle(0, 0, 26);
    this.terminarEn(g, 450, this.opciones.reducido() ? null : { alpha: 0 });
  }

  // Lo que ve el e2e: persistentes y transitorios vivos.
  entradasDebug(): DebugEfectoVisible[] {
    const datos = this.datos;
    const persistentes = [...this.vivos.values()].map((vivo) => this.entradaPersistente(vivo, datos));
    return [...persistentes, ...this.transitorios.map((t) => t.entrada)];
  }

  destruir(): void {
    for (const vivo of this.vivos.values()) this.destruirVivo(vivo);
    this.vivos.clear();
    for (const t of [...this.transitorios]) this.cerrarTransitorio(t);
  }

  private entradaPersistente(vivo: Vivo, datos: DatosEventos | null): DebugEfectoVisible {
    const nave = vivo.plan.nave;
    const sobre = nave !== undefined ? "nave" : vivo.plan.tipo === "agujero-negro" ? "planeta" : "vacio";
    return {
      tipo: etiquetaDebug(vivo.plan.tipo),
      x: vivo.contenedor.x,
      y: vivo.contenedor.y,
      radioOnda: 0,
      particulas: 0,
      escala: datos?.mundoPorCss ?? 1,
      sobre,
      ...(nave !== undefined ? { nave } : {}),
    };
  }

  private crearVivo(plan: EfectoPersistente, datos: DatosEventos): Vivo | null {
    const contenedor = this.escena.add.container(0, 0).setDepth(PROFUNDIDAD_AURA);
    const tweens: Phaser.Tweens.Tween[] = [];
    const vivo: Vivo = { clave: plan.clave, plan, contenedor, tweens };
    const reducido = this.opciones.reducido();
    switch (plan.tipo) {
      case "vitaminas":
        this.auraVitaminas(vivo, reducido);
        break;
      case "virus":
        this.burbujasVirus(vivo, reducido);
        break;
      case "gravedad-x2":
      case "gravedad-mitad":
        this.iconoGravedad(vivo, datos);
        break;
      case "viento-solar":
        this.estelasViento(vivo, datos, reducido);
        break;
      case "agujero-negro":
        this.espiralAgujero(vivo, reducido);
        break;
      case "corazon":
        this.latidoCorazon(vivo, reducido);
        break;
      case "tormenta":
        this.chispasTormenta(vivo, reducido);
        break;
      default:
        contenedor.destroy();
        return null;
    }
    this.colocar(vivo, datos);
    return vivo;
  }

  private colocar(vivo: Vivo, datos: DatosEventos): void {
    const { plan, contenedor } = vivo;
    if (plan.nave !== undefined) {
      const posicion = datos.naves[plan.nave];
      if (posicion) contenedor.setPosition(posicion.x, posicion.y - OFFSET_AURA_NAVE_U);
    } else if (plan.objeto !== undefined) {
      const objeto = datos.objetos.find((candidato) => candidato.id === plan.objeto);
      if (objeto) contenedor.setPosition(objeto.x, objeto.y);
    } else if (plan.tipo === "agujero-negro") {
      const pozo = datos.planetas.find((candidato) => candidato.id === ID_AGUJERO_NEGRO);
      if (pozo) contenedor.setPosition(pozo.x, pozo.y);
    } else if (plan.tipo === "gravedad-x2" || plan.tipo === "gravedad-mitad") {
      contenedor.setPosition(250 * datos.mundoPorCss, 70 * datos.mundoPorCss);
    } else {
      contenedor.setPosition(datos.ancho / 2, datos.alto / 2);
    }
  }

  private destruirVivo(vivo: Vivo): void {
    for (const tween of vivo.tweens) tween.remove();
    vivo.contenedor.destroy(true);
  }

  private pulso(vivo: Vivo, objetivo: object, desde: number, hasta: number, duracionMs: number): void {
    vivo.tweens.push(this.escena.tweens.add({ targets: objetivo, scale: { from: desde, to: hasta }, duration: duracionMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));
  }

  private auraVitaminas(vivo: Vivo, reducido: boolean): void {
    const g = this.escena.add.graphics();
    g.fillStyle(0x4cff7a, 0.16);
    g.fillCircle(0, 0, 44);
    g.lineStyle(3, 0x7dffa0, 0.85);
    g.strokeCircle(0, 0, 44);
    // Cuatro cruces: la «vitamina» se lee aun sin animación.
    g.lineStyle(3, 0xd8ffe2, 0.95);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = Math.cos(a) * 44;
      const cy = Math.sin(a) * 44;
      g.lineBetween(cx - 6, cy, cx + 6, cy);
      g.lineBetween(cx, cy - 6, cx, cy + 6);
    }
    vivo.contenedor.add(g);
    if (!reducido) this.pulso(vivo, g, 0.88, 1.16, 650);
  }

  private burbujasVirus(vivo: Vivo, reducido: boolean): void {
    for (let i = 0; i < 7; i++) {
      const g = this.escena.add.graphics();
      const radio = 5 + fraccion(i, 1) * 6;
      g.fillStyle(i % 2 === 0 ? 0x6bd36b : 0xa05cff, 0.55);
      g.fillCircle(0, 0, radio);
      g.lineStyle(2, i % 2 === 0 ? 0xc9ffc9 : 0xe0c9ff, 0.9);
      g.strokeCircle(0, 0, radio);
      const angulo = (i / 7) * Math.PI * 2;
      g.setPosition(Math.cos(angulo) * 38, Math.sin(angulo) * 30);
      vivo.contenedor.add(g);
      if (!reducido) {
        vivo.tweens.push(this.escena.tweens.add({ targets: g, y: g.y - 22, alpha: 0.25, duration: 900 + i * 90, yoyo: true, repeat: -1, delay: i * 120, ease: "Sine.easeInOut" }));
      }
    }
  }

  private iconoGravedad(vivo: Vivo, datos: DatosEventos): void {
    const doble = vivo.plan.tipo === "gravedad-x2";
    const k = datos.mundoPorCss;
    const g = this.escena.add.graphics();
    g.fillStyle(0x10131c, 0.85);
    g.fillCircle(0, 0, 14 * k);
    g.lineStyle(2 * k, doble ? 0xff9a5c : 0x7ec8ff, 1);
    g.strokeCircle(0, 0, 14 * k);
    // Una flecha hacia abajo (más gravedad) o hacia arriba (menos), tantas veces como el factor.
    const sentido = doble ? 1 : -1;
    for (let i = 0; i < (doble ? 2 : 1); i++) {
      const y = (doble ? -6 + i * 8 : 0) * k * sentido;
      g.lineBetween(-5 * k, y - 3 * k * sentido, 0, y + 3 * k * sentido);
      g.lineBetween(5 * k, y - 3 * k * sentido, 0, y + 3 * k * sentido);
    }
    const texto = this.escena.add
      .text(20 * k, 0, doble ? "×2" : "÷2", { fontFamily: "sans-serif", fontSize: `${Math.round(14 * k)}px`, fontStyle: "bold", color: doble ? "#ffb88a" : "#a8dcff", stroke: "#000000", strokeThickness: Math.round(2 * k) })
      .setOrigin(0, 0.5);
    vivo.contenedor.add([g, texto]);
  }

  private estelasViento(vivo: Vivo, datos: DatosEventos, reducido: boolean): void {
    const sentido = (vivo.plan.derivaAnadida ?? 1) >= 0 ? 1 : -1;
    const ancho = datos.ancho;
    const alto = datos.alto;
    for (let i = 0; i < 9; i++) {
      const g = this.escena.add.graphics();
      const largo = 90 + fraccion(i, 2) * 90;
      g.lineStyle(2, 0xcfe8ff, 0.55);
      g.lineBetween(-largo / 2, 0, largo / 2, 0);
      // El contenedor está en el centro del mundo: las coordenadas son relativas.
      const y = (fraccion(i, 3) - 0.5) * alto * 0.9;
      const xInicio = -sentido * (ancho / 2 + largo);
      const xFin = sentido * (ancho / 2 + largo);
      g.setPosition(reducido ? (fraccion(i, 4) - 0.5) * ancho * 0.8 : xInicio, y);
      vivo.contenedor.add(g);
      if (!reducido) {
        vivo.tweens.push(this.escena.tweens.add({ targets: g, x: xFin, duration: 2600 + fraccion(i, 5) * 1400, repeat: -1, delay: fraccion(i, 6) * 2000 }));
      }
    }
  }

  private espiralAgujero(vivo: Vivo, reducido: boolean): void {
    const g = this.escena.add.graphics();
    // Disco de acreción: tres elipses concéntricas.
    for (let i = 0; i < 3; i++) {
      g.lineStyle(3, [0xffb347, 0xc084ff, 0x6a5acd][i], 0.75 - i * 0.15);
      g.strokeEllipse(0, 0, (RADIO_AGUJERO_NEGRO * 2 + 30 + i * 22) * 1.0, (RADIO_AGUJERO_NEGRO * 2 + 30 + i * 22) * 0.42);
    }
    // Espiral hacia el centro.
    g.lineStyle(2, 0xe9d5ff, 0.85);
    g.beginPath();
    for (let paso = 0; paso <= 60; paso++) {
      const t = paso / 60;
      const a = t * Math.PI * 5;
      const r = RADIO_AGUJERO_NEGRO * 2.4 * (1 - t) + 4;
      if (paso === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.strokePath();
    g.fillStyle(0x000000, 1);
    g.fillCircle(0, 0, RADIO_AGUJERO_NEGRO * 0.7);
    vivo.contenedor.add(g);
    if (!reducido) vivo.tweens.push(this.escena.tweens.add({ targets: g, angle: 360, duration: 4200, repeat: -1 }));
  }

  private latidoCorazon(vivo: Vivo, reducido: boolean): void {
    const g = this.escena.add.graphics();
    g.lineStyle(3, 0x5dff8a, 0.8);
    g.strokeCircle(0, 0, 40);
    g.fillStyle(0xff4d79, 0.18);
    g.fillCircle(0, 0, 40);
    vivo.contenedor.add(g);
    if (!reducido) this.pulso(vivo, g, 0.8, 1.2, 420);
  }

  private chispasTormenta(vivo: Vivo, reducido: boolean): void {
    for (let i = 0; i < 5; i++) {
      const g = this.escena.add.graphics();
      g.lineStyle(3, 0xfff27a, 1);
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
      g.lineTo(Math.cos(a + 0.2) * 42, Math.sin(a + 0.2) * 42);
      g.lineTo(Math.cos(a - 0.1) * 50, Math.sin(a - 0.1) * 50);
      g.strokePath();
      vivo.contenedor.add(g);
      if (!reducido) {
        vivo.tweens.push(this.escena.tweens.add({ targets: g, alpha: 0.1, duration: 140 + i * 40, yoyo: true, repeat: -1, delay: i * 70 }));
      }
    }
  }

  private registrarTransitorio(tipo: TipoEvento, x: number, y: number, objetos: Phaser.GameObjects.GameObject[], tweens: Phaser.Tweens.Tween[], sobre: "nave" | "planeta" | "vacio", nave?: number): void {
    const duracion = DURACION_TRANSITORIO_MS[tipo] ?? 1500;
    const entrada: DebugEfectoVisible = { tipo: etiquetaDebug(tipo), x, y, radioOnda: 0, particulas: 0, escala: 1, sobre, duracionMs: duracion, ...(nave !== undefined ? { nave } : {}) };
    const transitorio: Transitorio = { entrada, objetos, tweens };
    this.transitorios.push(transitorio);
    this.escena.time.delayedCall(duracion, () => this.cerrarTransitorio(transitorio));
    this.opciones.alCambiar();
  }

  private cerrarTransitorio(transitorio: Transitorio): void {
    if (!this.transitorios.includes(transitorio)) return;
    this.transitorios = this.transitorios.filter((otro) => otro !== transitorio);
    for (const tween of transitorio.tweens) tween.remove();
    for (const objeto of transitorio.objetos) objeto.destroy();
    this.opciones.alCambiar();
  }

  private terminarEn(g: Phaser.GameObjects.Graphics, ms: number, destino: { alpha?: number; scale?: number } | null): void {
    if (destino) this.escena.tweens.add({ targets: g, ...destino, duration: ms, onComplete: () => g.destroy() });
    else this.escena.time.delayedCall(ms, () => g.destroy());
  }

  private lluviaDeMonedas(nave: number, datos: DatosEventos, reducido: boolean): void {
    const posicion = datos.naves[nave];
    if (!posicion) return;
    const objetos: Phaser.GameObjects.GameObject[] = [];
    const tweens: Phaser.Tweens.Tween[] = [];
    for (let i = 0; i < 10; i++) {
      const moneda = this.escena.add.graphics().setDepth(PROFUNDIDAD_TRANSITORIO);
      moneda.fillStyle(0xffd23f, 1);
      moneda.fillCircle(0, 0, 7);
      moneda.lineStyle(2, 0xb8860b, 1);
      moneda.strokeCircle(0, 0, 7);
      const x = posicion.x + (fraccion(i, 7) - 0.5) * 70;
      const yFinal = posicion.y - OFFSET_AURA_NAVE_U + (fraccion(i, 8) - 0.3) * 24;
      moneda.setPosition(x, reducido ? yFinal : yFinal - 90);
      objetos.push(moneda);
      if (!reducido) tweens.push(this.escena.tweens.add({ targets: moneda, y: yFinal, duration: 700, delay: i * 90, ease: "Bounce.easeOut" }));
    }
    const k = datos.mundoPorCss;
    const texto = this.escena.add
      .text(posicion.x, posicion.y - 50, "+150 cr", { fontFamily: "sans-serif", fontSize: `${Math.round(18 * k)}px`, fontStyle: "bold", color: "#ffd23f", stroke: "#000000", strokeThickness: Math.round(3 * k) })
      .setOrigin(0.5, 1)
      .setDepth(PROFUNDIDAD_TRANSITORIO + 1);
    objetos.push(texto);
    if (!reducido) tweens.push(this.escena.tweens.add({ targets: texto, y: texto.y - 36 * k, duration: 1600, ease: "Quad.easeOut" }));
    this.registrarTransitorio("loteria", posicion.x, posicion.y, objetos, tweens, "nave", nave);
  }

  private barridoDeReparacion(datos: DatosEventos, reducido: boolean): void {
    const objetos: Phaser.GameObjects.GameObject[] = [];
    const tweens: Phaser.Tweens.Tween[] = [];
    for (const pozo of datos.planetas) {
      if (pozo.id === ID_AGUJERO_NEGRO) continue;
      const g = this.escena.add.graphics().setDepth(PROFUNDIDAD_TRANSITORIO).setPosition(pozo.x, pozo.y);
      g.fillStyle(0x4de8ff, 0.28);
      g.fillCircle(0, 0, pozo.radio);
      g.lineStyle(4, 0xb8f6ff, 0.95);
      g.strokeCircle(0, 0, pozo.radio);
      objetos.push(g);
      if (!reducido) {
        g.setScale(0.2);
        tweens.push(this.escena.tweens.add({ targets: g, scale: 1.05, duration: 800, ease: "Sine.easeOut" }));
        tweens.push(this.escena.tweens.add({ targets: g, alpha: 0, duration: 700, delay: 1300 }));
      }
    }
    this.registrarTransitorio("reparacion", datos.ancho / 2, datos.alto / 2, objetos, tweens, "planeta");
  }

  private sacudidaYPolvo(datos: DatosEventos, reducido: boolean): void {
    // El polvo se ve siempre; solo la cámara obedece al interruptor Sacudida.
    if (!reducido && this.opciones.sacudidaActiva()) this.opciones.sacudir(700, 0.012);
    const objetos: Phaser.GameObjects.GameObject[] = [];
    const tweens: Phaser.Tweens.Tween[] = [];
    let indice = 0;
    for (const pozo of datos.planetas) {
      if (pozo.id === ID_AGUJERO_NEGRO) continue;
      for (let i = 0; i < 8; i++, indice++) {
        const a = (i / 8) * Math.PI * 2 + fraccion(indice, 9);
        const mota = this.escena.add.graphics().setDepth(PROFUNDIDAD_TRANSITORIO);
        mota.fillStyle(0xc9b79c, 0.8);
        mota.fillCircle(0, 0, 4 + fraccion(indice, 10) * 4);
        mota.setPosition(pozo.x + Math.cos(a) * pozo.radio, pozo.y + Math.sin(a) * pozo.radio);
        objetos.push(mota);
        if (!reducido) tweens.push(this.escena.tweens.add({ targets: mota, y: mota.y - 26, x: mota.x + Math.cos(a) * 14, alpha: 0.1, duration: 1500, ease: "Quad.easeOut" }));
      }
    }
    this.registrarTransitorio("terremoto", datos.ancho / 2, datos.alto / 2, objetos, tweens, "planeta");
  }
}
