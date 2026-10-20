// Único dueño de la cámara principal: cualquier otro sitio que quiera
// encuadrar (el remate de #240, el seguimiento del proyectil, los gestos) se
// lo pide a este controlador. Sin Phaser ni DOM -- solo lo mínimo de la cámara
// -- para poder probar con propiedades que ninguna secuencia de gestos saca el
// encuadre del mundo.
export const ZOOM_VISTA_COMPLETA = 1;
export const ZOOM_MAXIMO = 3;
export const DURACION_VER_TODO_MS = 300;
export const LERP_SEGUIMIENTO = 0.1;
// Fracción del encuadre que el proyectil nunca puede pisar por el borde.
const MARGEN_SEGUIMIENTO = 0.1;
const FOTOGRAMA_REFERENCIA_MS = 1000 / 60;

export type ModoCamara = "auto" | "manual";

export interface CamaraFisica {
  setZoom(zoom: number): unknown;
  setScroll(x: number, y: number): unknown;
}

export interface Dimensiones {
  readonly ancho: number;
  readonly alto: number;
}

// El centro (y no el scroll de Phaser) es la magnitud estable: el scroll de una
// cámara con origen centrado depende del zoom.
export interface Encuadre {
  readonly zoom: number;
  readonly cx: number;
  readonly cy: number;
}

export interface Vista {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

// Posición relativa dentro del lienzo, 0..1 en cada eje.
export interface Fraccion {
  readonly fx: number;
  readonly fy: number;
}

export interface EstadoCamara extends Vista {
  readonly zoom: number;
  readonly modo: ModoCamara;
}

export function vistaDe(e: Encuadre, dim: Dimensiones): Vista {
  const ancho = dim.ancho / e.zoom;
  const alto = dim.alto / e.zoom;
  return { x: e.cx - ancho / 2, y: e.cy - alto / 2, ancho, alto };
}

function entre(v: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, v));
}

// Zoom dentro de [vista completa, 3×] y el rectángulo visible dentro del mundo.
export function limitarEncuadre(e: Encuadre, dim: Dimensiones): Encuadre {
  const zoom = entre(Number.isFinite(e.zoom) ? e.zoom : ZOOM_VISTA_COMPLETA, ZOOM_VISTA_COMPLETA, ZOOM_MAXIMO);
  const mitadAncho = dim.ancho / zoom / 2;
  const mitadAlto = dim.alto / zoom / 2;
  return {
    zoom,
    cx: entre(Number.isFinite(e.cx) ? e.cx : dim.ancho / 2, mitadAncho, dim.ancho - mitadAncho),
    cy: entre(Number.isFinite(e.cy) ? e.cy : dim.alto / 2, mitadAlto, dim.alto - mitadAlto),
  };
}

export function encuadreCompleto(dim: Dimensiones): Encuadre {
  return { zoom: ZOOM_VISTA_COMPLETA, cx: dim.ancho / 2, cy: dim.alto / 2 };
}

// Escala y desplaza a la vez: el punto del mundo que estaba bajo `previo` queda
// bajo `nuevo` tras el factor. Con previo = nuevo es un zoom anclado (rueda);
// con factor 1, un arrastre.
export function transformarEncuadre(e: Encuadre, dim: Dimensiones, previo: Fraccion, nuevo: Fraccion, factor: number): Encuadre {
  const antes = vistaDe(e, dim);
  const zoom = entre(e.zoom * (Number.isFinite(factor) && factor > 0 ? factor : 1), ZOOM_VISTA_COMPLETA, ZOOM_MAXIMO);
  const px = antes.x + previo.fx * antes.ancho;
  const py = antes.y + previo.fy * antes.alto;
  const ancho = dim.ancho / zoom;
  const alto = dim.alto / zoom;
  return limitarEncuadre({ zoom, cx: px - nuevo.fx * ancho + ancho / 2, cy: py - nuevo.fy * alto + alto / 2 }, dim);
}

export interface SeguimientoProyectil {
  readonly x: number;
  readonly y: number;
}

// El encuadre se mueve hacia el proyectil con lerp, pero el proyectil nunca
// queda fuera del recuadro interior: a pocos fotogramas por segundo un lerp
// puro se queda atrás.
export function seguirProyectil(e: Encuadre, dim: Dimensiones, proyectil: SeguimientoProyectil, deltaMs: number): Encuadre {
  const k = 1 - Math.pow(1 - LERP_SEGUIMIENTO, Math.max(0, deltaMs) / FOTOGRAMA_REFERENCIA_MS);
  let cx = e.cx + (proyectil.x - e.cx) * k;
  let cy = e.cy + (proyectil.y - e.cy) * k;
  const holguraX = (dim.ancho / e.zoom / 2) * (1 - MARGEN_SEGUIMIENTO * 2);
  const holguraY = (dim.alto / e.zoom / 2) * (1 - MARGEN_SEGUIMIENTO * 2);
  cx = entre(cx, proyectil.x - holguraX, proyectil.x + holguraX);
  cy = entre(cy, proyectil.y - holguraY, proyectil.y + holguraY);
  return limitarEncuadre({ zoom: e.zoom, cx, cy }, dim);
}

function suavizado(t: number): number {
  return t * t * (3 - 2 * t);
}

export interface InstantaneaCamara {
  readonly encuadre: Encuadre;
  readonly modo: ModoCamara;
}

export class ControladorCamara {
  private encuadre: Encuadre;
  private modo: ModoCamara = "auto";
  private vuelta: { desde: Encuadre; transcurridoMs: number } | null = null;
  // Un encuadre externo (el remate) no se limita ni lo toca el seguimiento.
  private externo = false;

  constructor(
    private dim: Dimensiones,
    private readonly camara: CamaraFisica,
    private readonly movimientoReducido: () => boolean,
  ) {
    this.encuadre = encuadreCompleto(dim);
    this.aplicar();
  }

  estado(): EstadoCamara {
    return { ...vistaDe(this.encuadre, this.dim), zoom: this.encuadre.zoom, modo: this.modo };
  }

  // El botón «Ver todo» se muestra solo en manual y mientras no vuelve ya.
  get manual(): boolean {
    return this.modo === "manual" && this.vuelta === null && !this.externo;
  }

  redimensionar(dim: Dimensiones): void {
    this.dim = dim;
    this.encuadre = this.modo === "auto" ? encuadreCompleto(dim) : limitarEncuadre(this.encuadre, dim);
    this.aplicar();
  }

  transformar(previo: Fraccion, nuevo: Fraccion, factor: number): void {
    if (this.externo) return;
    this.vuelta = null;
    this.encuadre = transformarEncuadre(this.encuadre, this.dim, previo, nuevo, factor);
    // Desde la vista completa solo cuenta el gesto que de verdad se acerca; si
    // se vuelve a 1× a mano, «Ver todo» deja de tener nada que enseñar.
    this.modo = this.encuadre.zoom > ZOOM_VISTA_COMPLETA + 1e-9 ? "manual" : "auto";
    this.aplicar();
  }

  verTodo(): void {
    if (this.externo) return;
    if (this.movimientoReducido()) {
      this.irACompleta();
      return;
    }
    this.vuelta = { desde: this.encuadre, transcurridoMs: 0 };
  }

  // Cambio de turno o relevo: sin animación, la vista completa ya.
  alCambiarTurno(): void {
    if (this.externo) return;
    this.irACompleta();
  }

  seguir(proyectil: SeguimientoProyectil | null, deltaMs: number): void {
    if (this.externo || proyectil === null || this.modo !== "manual" || this.vuelta !== null) return;
    this.encuadre = seguirProyectil(this.encuadre, this.dim, proyectil, deltaMs);
    this.aplicar();
  }

  avanzar(deltaMs: number): void {
    const v = this.vuelta;
    if (v === null) return;
    v.transcurridoMs += Math.max(0, deltaMs);
    const t = Math.min(1, v.transcurridoMs / DURACION_VER_TODO_MS);
    if (t >= 1) {
      this.irACompleta();
      return;
    }
    const k = suavizado(t);
    const meta = encuadreCompleto(this.dim);
    this.encuadre = {
      zoom: v.desde.zoom + (meta.zoom - v.desde.zoom) * k,
      cx: v.desde.cx + (meta.cx - v.desde.cx) * k,
      cy: v.desde.cy + (meta.cy - v.desde.cy) * k,
    };
    this.aplicar();
  }

  instantanea(): InstantaneaCamara {
    return { encuadre: this.encuadre, modo: this.modo };
  }

  // Encuadre del remate: pasa por aquí para que nadie más toque la cámara.
  fijarExterno(e: Encuadre): void {
    this.externo = true;
    this.vuelta = null;
    this.encuadre = e;
    this.aplicar();
  }

  restaurar(snap: InstantaneaCamara): void {
    this.externo = false;
    this.vuelta = null;
    this.encuadre = snap.encuadre;
    this.modo = snap.modo;
    this.aplicar();
  }

  private irACompleta(): void {
    this.vuelta = null;
    this.modo = "auto";
    this.encuadre = encuadreCompleto(this.dim);
    this.aplicar();
  }

  private aplicar(): void {
    this.camara.setZoom(this.encuadre.zoom);
    this.camara.setScroll(this.encuadre.cx - this.dim.ancho / 2, this.encuadre.cy - this.dim.alto / 2);
  }
}
