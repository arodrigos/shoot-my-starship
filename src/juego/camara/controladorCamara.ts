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
// Holgura (fracción del lado menor) que se le da al proyectil para alejar la
// cámara antes de que llegue al borde de lo visible.
const MARGEN_PROYECTIL = 0.06;
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

// Rectángulo en px de lienzo (la misma unidad que Dimensiones).
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

// Algo que tiene que verse: su rectángulo está en coordenadas de mundo.
export interface ObjetivoEncuadre extends Rect {
  readonly tipo: "nave" | "proyectil" | "impacto";
}

export type MotivoZonas = "usuario" | "apartado" | "turno";
export type MotivoReencuadre = "inicial" | "turno" | "usuario" | "vuelo" | "ver-todo" | "degenerado";

// Un libre más estrecho que esto no sirve para encuadrar nada: se vuelve a la
// vista completa y el motivo lo dice.
export const FRACCION_LIBRE_MINIMA = 0.25;
const EPS = 1e-6;

export function vistaDe(e: Encuadre, dim: Dimensiones): Vista {
  const ancho = dim.ancho / e.zoom;
  const alto = dim.alto / e.zoom;
  return { x: e.cx - ancho / 2, y: e.cy - alto / 2, ancho, alto };
}

function entre(v: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, v));
}

function lienzoCompleto(dim: Dimensiones): Rect {
  return { x: 0, y: 0, ancho: dim.ancho, alto: dim.alto };
}

function solapan(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.ancho - EPS && b.x < a.x + a.ancho - EPS && a.y < b.y + b.alto - EPS && b.y < a.y + a.alto - EPS;
}

// El mayor rectángulo vacío entre los candidatos que forman los bordes de las
// zonas y del lienzo. Con las pocas zonas que hay (≤ 5) son decenas, no hace
// falta nada más listo.
export function rectanguloLibre(dim: Dimensiones, zonas: readonly Rect[]): Rect {
  const completo = lienzoCompleto(dim);
  const utiles = zonas.filter((z) => z.ancho > 0 && z.alto > 0 && solapan(z, completo));
  if (utiles.length === 0) return completo;
  const xs = new Set<number>([0, dim.ancho]);
  const ys = new Set<number>([0, dim.alto]);
  for (const z of utiles) {
    for (const v of [z.x, z.x + z.ancho]) xs.add(entre(v, 0, dim.ancho));
    for (const v of [z.y, z.y + z.alto]) ys.add(entre(v, 0, dim.alto));
  }
  const ordX = [...xs].sort((a, b) => a - b);
  const ordY = [...ys].sort((a, b) => a - b);
  let mejor: Rect = { x: 0, y: 0, ancho: 0, alto: 0 };
  let areaMejor = 0;
  for (let i = 0; i < ordX.length; i++) {
    for (let j = i + 1; j < ordX.length; j++) {
      for (let k = 0; k < ordY.length; k++) {
        for (let l = k + 1; l < ordY.length; l++) {
          const r = { x: ordX[i], y: ordY[k], ancho: ordX[j] - ordX[i], alto: ordY[l] - ordY[k] };
          const area = r.ancho * r.alto;
          if (area <= areaMejor || utiles.some((z) => solapan(r, z))) continue;
          mejor = r;
          areaMejor = area;
        }
      }
    }
  }
  return mejor;
}

// El zoom que mete el mundo entero en el rectángulo libre (nunca más de 1×).
export function zoomMinimo(dim: Dimensiones, libre: Rect): number {
  const z = Math.min(libre.ancho / dim.ancho, libre.alto / dim.alto, ZOOM_VISTA_COMPLETA);
  return Number.isFinite(z) && z > 0 ? z : ZOOM_VISTA_COMPLETA;
}

// Zoom dentro de [zoomMinimo, 3×] y la proyección del rectángulo libre dentro
// del mundo en el eje donde cabe: solo se sale del mundo lo que queda bajo una
// zona. Sin `libre` (sin zonas) es el lienzo entero, el comportamiento de siempre.
export function limitarEncuadre(e: Encuadre, dim: Dimensiones, libre: Rect = lienzoCompleto(dim)): Encuadre {
  const zoom = entre(Number.isFinite(e.zoom) ? e.zoom : ZOOM_VISTA_COMPLETA, zoomMinimo(dim, libre), ZOOM_MAXIMO);
  const cx0 = Number.isFinite(e.cx) ? e.cx : dim.ancho / 2;
  const cy0 = Number.isFinite(e.cy) ? e.cy : dim.alto / 2;
  return { zoom, cx: centroLimitado(cx0, zoom, dim.ancho, libre.x, libre.ancho), cy: centroLimitado(cy0, zoom, dim.alto, libre.y, libre.alto) };
}

// En el eje, el mundo mide lo mismo que el lienzo (dim): el punto de lienzo u
// está en el mundo en c + (u - dim/2) / zoom.
function centroLimitado(c: number, zoom: number, dim: number, libreIni: number, libreLargo: number): number {
  const proyeccion = libreLargo / zoom;
  if (proyeccion >= dim - EPS) {
    // Con el libre más grande que el mundo (zoom en su mínimo), el mundo queda
    // centrado en el libre.
    return dim / 2 - (libreIni + libreLargo / 2 - dim / 2) / zoom;
  }
  const izquierda = entre(c + (libreIni - dim / 2) / zoom, 0, dim - proyeccion);
  return izquierda - (libreIni - dim / 2) / zoom;
}

export function encuadreCompleto(dim: Dimensiones): Encuadre {
  return { zoom: ZOOM_VISTA_COMPLETA, cx: dim.ancho / 2, cy: dim.alto / 2 };
}

// Escala y desplaza a la vez: el punto del mundo que estaba bajo `previo` queda
// bajo `nuevo` tras el factor. Con previo = nuevo es un zoom anclado (rueda);
// con factor 1, un arrastre.
export function transformarEncuadre(
  e: Encuadre,
  dim: Dimensiones,
  previo: Fraccion,
  nuevo: Fraccion,
  factor: number,
  libre: Rect = lienzoCompleto(dim),
): Encuadre {
  const antes = vistaDe(e, dim);
  const zoom = entre(e.zoom * (Number.isFinite(factor) && factor > 0 ? factor : 1), zoomMinimo(dim, libre), ZOOM_MAXIMO);
  const px = antes.x + previo.fx * antes.ancho;
  const py = antes.y + previo.fy * antes.alto;
  const ancho = dim.ancho / zoom;
  const alto = dim.alto / zoom;
  return limitarEncuadre({ zoom, cx: px - nuevo.fx * ancho + ancho / 2, cy: py - nuevo.fy * alto + alto / 2 }, dim, libre);
}

// Rectángulo de lienzo (px) que ocupa un objetivo del mundo con este encuadre.
export function objetivoEnLienzo(o: Rect, e: Encuadre, dim: Dimensiones): Rect {
  const v = vistaDe(e, dim);
  return { x: (o.x - v.x) * e.zoom, y: (o.y - v.y) * e.zoom, ancho: o.ancho * e.zoom, alto: o.alto * e.zoom };
}

// Todo lo importante cae dentro del lienzo y sin tocar ninguna zona visible.
export function encuadreValido(e: Encuadre, dim: Dimensiones, zonas: readonly Rect[], objetivos: readonly ObjetivoEncuadre[]): boolean {
  return objetivos.every((o) => {
    const r = objetivoEnLienzo(o, e, dim);
    const dentro = r.x >= -EPS && r.y >= -EPS && r.x + r.ancho <= dim.ancho + EPS && r.y + r.alto <= dim.alto + EPS;
    return dentro && !zonas.some((z) => solapan(r, z));
  });
}

// La vista completa de siempre si sirve; si no, el grupo importante en el mayor
// rectángulo libre, con zoom ≤ 1.
export function encuadreAuto(dim: Dimensiones, zonas: readonly Rect[], objetivos: readonly ObjetivoEncuadre[]): Encuadre {
  const completo = encuadreCompleto(dim);
  if (encuadreValido(completo, dim, zonas, objetivos)) return completo;
  const libre = rectanguloLibre(dim, zonas);
  if (libre.ancho < dim.ancho * FRACCION_LIBRE_MINIMA || libre.alto < dim.alto * FRACCION_LIBRE_MINIMA) return completo;
  const x0 = Math.min(...objetivos.map((o) => o.x));
  const y0 = Math.min(...objetivos.map((o) => o.y));
  const x1 = Math.max(...objetivos.map((o) => o.x + o.ancho));
  const y1 = Math.max(...objetivos.map((o) => o.y + o.alto));
  const minimo = zoomMinimo(dim, libre);
  const zoom = entre(Math.min(libre.ancho / Math.max(x1 - x0, 1), libre.alto / Math.max(y1 - y0, 1)), minimo, ZOOM_VISTA_COMPLETA);
  // El centro del grupo va al centro del libre; limitarEncuadre lo recoloca
  // para que la proyección del libre no salga del mundo (sin perder el grupo,
  // que está dentro del mundo).
  const cx = (x0 + x1) / 2 - (libre.x + libre.ancho / 2 - dim.ancho / 2) / zoom;
  const cy = (y0 + y1) / 2 - (libre.y + libre.alto / 2 - dim.alto / 2) / zoom;
  return limitarEncuadre({ zoom, cx, cy }, dim, libre);
}

export interface SeguimientoProyectil {
  readonly x: number;
  readonly y: number;
}

// El encuadre se mueve hacia el proyectil con lerp, pero el proyectil nunca
// queda fuera del recuadro interior: a pocos fotogramas por segundo un lerp
// puro se queda atrás.
export function seguirProyectil(
  e: Encuadre,
  dim: Dimensiones,
  proyectil: SeguimientoProyectil,
  deltaMs: number,
  libre: Rect = lienzoCompleto(dim),
): Encuadre {
  const k = 1 - Math.pow(1 - LERP_SEGUIMIENTO, Math.max(0, deltaMs) / FOTOGRAMA_REFERENCIA_MS);
  const desfaseX = (libre.x + libre.ancho / 2 - dim.ancho / 2) / e.zoom;
  const desfaseY = (libre.y + libre.alto / 2 - dim.alto / 2) / e.zoom;
  let cx = e.cx + (proyectil.x - desfaseX - e.cx) * k;
  let cy = e.cy + (proyectil.y - desfaseY - e.cy) * k;
  // El recuadro interior es el del rectángulo libre, no el del lienzo: el
  // proyectil no debe quedarse tras una zona.
  const holguraX = (libre.ancho / e.zoom / 2) * (1 - MARGEN_SEGUIMIENTO * 2);
  const holguraY = (libre.alto / e.zoom / 2) * (1 - MARGEN_SEGUIMIENTO * 2);
  cx = entre(cx, proyectil.x - desfaseX - holguraX, proyectil.x - desfaseX + holguraX);
  cy = entre(cy, proyectil.y - desfaseY - holguraY, proyectil.y - desfaseY + holguraY);
  return limitarEncuadre({ zoom: e.zoom, cx, cy }, dim, libre);
}

function suavizado(t: number): number {
  return t * t * (3 - 2 * t);
}

export interface InstantaneaCamara {
  readonly encuadre: Encuadre;
  readonly modo: ModoCamara;
}

function cercanos(a: Encuadre, b: Encuadre): boolean {
  return Math.abs(a.zoom - b.zoom) < 1e-4 && Math.abs(a.cx - b.cx) < 0.5 && Math.abs(a.cy - b.cy) < 0.5;
}

export interface DepuracionCamara {
  readonly zonas: readonly Rect[];
  readonly libre: Rect;
  readonly objetivos: readonly ObjetivoEncuadre[];
  readonly valido: boolean;
  readonly zoom: number;
  readonly modo: ModoCamara;
  readonly motivo: MotivoReencuadre | null;
  readonly reencuadres: number;
}

export class ControladorCamara {
  private encuadre: Encuadre;
  private modo: ModoCamara = "auto";
  private vuelta: { desde: Encuadre; hasta: Encuadre; transcurridoMs: number } | null = null;
  // Un encuadre externo (el remate) no se limita ni lo toca el seguimiento.
  private externo = false;
  // Las nominales son las zonas que la consola ocupa cuando está a la vista; las
  // visibles, las que tapan ahora mismo (la consola se aparta al disparar). El
  // encuadre preferido usa las nominales, para que no se mueva nada al
  // disparar ni al volver el turno; la validez, las visibles.
  private nominales: readonly Rect[] = [];
  private visibles: readonly Rect[] = [];
  private objetivos: readonly ObjetivoEncuadre[] = [];
  private motivo: MotivoReencuadre | null = null;
  private reencuadres = 0;
  // Se pone a true cuando un reencuadre por zonas empieza a moverse; la escena
  // lo recoge para cerrar la medida de latencia en el primer frame.
  private movimientoPorUsuario = false;

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

  depuracion(): DepuracionCamara {
    return {
      zonas: this.visibles,
      libre: this.libre(),
      objetivos: this.objetivos,
      valido: encuadreValido(this.encuadre, this.dim, this.visibles, this.objetivos),
      zoom: this.encuadre.zoom,
      modo: this.modo,
      motivo: this.motivo,
      reencuadres: this.reencuadres,
    };
  }

  // true una sola vez por cada reencuadre causado por un toque en el HUD.
  recogerMovimientoPorUsuario(): boolean {
    const v = this.movimientoPorUsuario;
    this.movimientoPorUsuario = false;
    return v;
  }

  redimensionar(dim: Dimensiones): void {
    this.dim = dim;
    this.vuelta = null;
    this.encuadre = this.modo === "auto" ? this.preferido() : limitarEncuadre(this.encuadre, dim, this.libre());
    this.aplicar();
  }

  fijarObjetivos(objetivos: readonly ObjetivoEncuadre[]): void {
    this.objetivos = objetivos;
  }

  // Cambian las zonas ocupadas. «usuario» y «turno» recalculan el encuadre
  // preferido (con transición el primero); «apartado» solo repara si lo
  // importante quedó tapado.
  fijarZonas(visibles: readonly Rect[], motivo: MotivoZonas, nominales: readonly Rect[] = visibles): void {
    this.visibles = visibles;
    this.nominales = nominales;
    if (this.externo || this.modo === "manual") return;
    if (motivo === "apartado") {
      if (!encuadreValido(this.encuadre, this.dim, this.visibles, this.objetivos)) this.irA(this.preferido(), "vuelo", true);
      return;
    }
    this.irA(this.preferido(), motivo, motivo === "usuario");
  }

  transformar(previo: Fraccion, nuevo: Fraccion, factor: number): void {
    if (this.externo) return;
    this.vuelta = null;
    this.encuadre = transformarEncuadre(this.encuadre, this.dim, previo, nuevo, factor, this.libre());
    // Es manual cuando el gesto deja un encuadre distinto del automático: si se
    // vuelve a él a mano, «Ver todo» deja de tener nada que enseñar.
    this.modo = cercanos(this.encuadre, this.preferido()) ? "auto" : "manual";
    this.aplicar();
  }

  verTodo(): void {
    if (this.externo) return;
    this.irA(this.preferido(), "ver-todo", true);
  }

  // Cambio de turno o relevo: sin animación, el encuadre preferido ya.
  // El estado del turno siguiente llega antes de que se vea el tiro: si la
  // vista de ahora sigue siendo válida y no hay vista completa que recuperar,
  // se queda donde está, para que las naves no se muevan al disparar.
  alCambiarTurno(): void {
    if (this.externo) return;
    const meta = this.preferido();
    const completa = encuadreCompleto(this.dim);
    if (this.modo === "auto" && this.vuelta === null && !cercanos(meta, completa) && encuadreValido(this.encuadre, this.dim, this.visibles, this.objetivos)) return;
    this.irA(meta, "turno", false);
  }

  seguir(proyectil: SeguimientoProyectil | null, deltaMs: number): void {
    if (this.externo || proyectil === null || this.vuelta !== null) return;
    if (this.modo === "manual") {
      this.encuadre = seguirProyectil(this.encuadre, this.dim, proyectil, deltaMs, this.libre());
      this.aplicar();
      return;
    }
    // En auto el proyectil se incluye en el grupo solo si va a salir de la
    // parte visible; la cámara se aleja amortiguada, nunca de golpe.
    const m = Math.min(this.dim.ancho, this.dim.alto) * MARGEN_PROYECTIL;
    const objetivo: ObjetivoEncuadre = { tipo: "proyectil", x: proyectil.x - m, y: proyectil.y - m, ancho: 2 * m, alto: 2 * m };
    if (encuadreValido(this.encuadre, this.dim, this.visibles, [objetivo])) return;
    if (objetivo.x < 0 || objetivo.y < 0 || objetivo.x + objetivo.ancho > this.dim.ancho || objetivo.y + objetivo.alto > this.dim.alto) return;
    const meta = encuadreAuto(this.dim, this.visibles, [...this.objetivos.filter((o) => o.tipo !== "proyectil"), objetivo]);
    if (cercanos(meta, this.encuadre)) return;
    const k = 1 - Math.pow(1 - LERP_SEGUIMIENTO, Math.max(0, deltaMs) / FOTOGRAMA_REFERENCIA_MS);
    this.encuadre = limitarEncuadre(
      { zoom: this.encuadre.zoom + (meta.zoom - this.encuadre.zoom) * k, cx: this.encuadre.cx + (meta.cx - this.encuadre.cx) * k, cy: this.encuadre.cy + (meta.cy - this.encuadre.cy) * k },
      this.dim,
      this.libre(),
    );
    this.motivo = "vuelo";
    this.aplicar();
  }

  avanzar(deltaMs: number): void {
    const v = this.vuelta;
    if (v === null) return;
    v.transcurridoMs += Math.max(0, deltaMs);
    const t = Math.min(1, v.transcurridoMs / DURACION_VER_TODO_MS);
    if (t >= 1) {
      this.vuelta = null;
      this.encuadre = v.hasta;
      this.aplicar();
      return;
    }
    const k = suavizado(t);
    this.encuadre = {
      zoom: v.desde.zoom + (v.hasta.zoom - v.desde.zoom) * k,
      cx: v.desde.cx + (v.hasta.cx - v.desde.cx) * k,
      cy: v.desde.cy + (v.hasta.cy - v.desde.cy) * k,
    };
    this.aplicar();
  }

  instantanea(): InstantaneaCamara {
    return { encuadre: this.encuadre, modo: this.modo };
  }

  // Encuadre del remate: pasa por aquí para que nadie más toque la cámara.
  // `antes` es el encuadre real previo al remate y `destino` el del acercamiento
  // (centrado en el impacto, con el desplazamiento del rectángulo libre); `k` va
  // de 0 (exactamente `antes`) a 1 (`destino`). Partir de zoom 1 y del centro
  // real aplicaba el desplazamiento del libre dos veces y dejaba la cámara a
  // cientos de unidades del encuadre de antes durante toda la vuelta.
  fijarExterno(antes: Encuadre, destino: Encuadre, k: number): void {
    this.externo = true;
    this.vuelta = null;
    // El impacto va al centro de lo que se ve, no al del lienzo entero.
    const libre = this.libre();
    const meta: Encuadre = {
      zoom: destino.zoom,
      cx: destino.cx - (libre.x + libre.ancho / 2 - this.dim.ancho / 2) / destino.zoom,
      cy: destino.cy - (libre.y + libre.alto / 2 - this.dim.alto / 2) / destino.zoom,
    };
    const t = Math.min(1, Math.max(0, k));
    this.encuadre = {
      zoom: antes.zoom * (1 - t) + meta.zoom * t,
      cx: antes.cx * (1 - t) + meta.cx * t,
      cy: antes.cy * (1 - t) + meta.cy * t,
    };
    this.aplicar();
  }

  restaurar(snap: InstantaneaCamara): void {
    this.externo = false;
    this.vuelta = null;
    this.encuadre = snap.encuadre;
    this.modo = snap.modo;
    this.aplicar();
  }

  // Rectángulo libre con las zonas nominales; si queda degenerado, el lienzo.
  private libre(): Rect {
    const libre = rectanguloLibre(this.dim, this.nominales);
    const degenerado = libre.ancho < this.dim.ancho * FRACCION_LIBRE_MINIMA || libre.alto < this.dim.alto * FRACCION_LIBRE_MINIMA;
    return degenerado ? lienzoCompleto(this.dim) : libre;
  }

  private preferido(): Encuadre {
    return encuadreAuto(this.dim, this.nominales, this.objetivos);
  }

  // Lleva la cámara al encuadre dado, con transición o sin ella. Si ya está ahí
  // no hace nada ni cuenta como reencuadre (idempotente).
  private irA(meta: Encuadre, motivo: MotivoReencuadre, animar: boolean): void {
    const yaEstaba = cercanos(meta, this.encuadre) && this.vuelta === null;
    this.modo = "auto";
    if (yaEstaba) return;
    this.reencuadres += 1;
    this.motivo = motivo;
    this.movimientoPorUsuario = motivo === "usuario" || motivo === "ver-todo";
    if (animar && !this.movimientoReducido()) {
      this.vuelta = { desde: this.encuadre, hasta: meta, transcurridoMs: 0 };
      return;
    }
    this.vuelta = null;
    this.encuadre = meta;
    this.aplicar();
  }

  private aplicar(): void {
    this.camara.setZoom(this.encuadre.zoom);
    this.camara.setScroll(this.encuadre.cx - this.dim.ancho / 2, this.encuadre.cy - this.dim.alto / 2);
  }
}
