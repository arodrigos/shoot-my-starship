// paron-explosion: mide lo que vive el jugador, no lo que cree el código. El
// delta de rAF delata cualquier frame largo; Long Animation Frames (donde
// exista) dice además qué fotograma excedió los 50 ms. Es de solo lectura y no
// toca la simulación ni el azar del núcleo.

export type MarcaRendimiento = "impacto" | "explosion" | "salida";

export interface MarcaRegistrada {
  readonly nombre: MarcaRendimiento;
  // performance.now() en el momento de la marca, para cruzarla con los frames.
  readonly t: number;
  // Índice (absoluto, no del búfer circular) del siguiente frame a registrar.
  readonly frame: number;
}

export interface FrameRegistrado {
  readonly t: number;
  readonly delta: number;
}

export interface InstantaneaRendimiento {
  readonly frames: number;
  readonly framesLargos: number;
  readonly p95: number;
  readonly max: number;
  readonly marcas: readonly MarcaRegistrada[];
  readonly deltas: readonly FrameRegistrado[];
}

export const CAPACIDAD_FRAMES = 600;
export const UMBRAL_FRAME_LARGO_MS = 50;

export function percentil(valores: readonly number[], p: number): number {
  if (valores.length === 0) {
    return 0;
  }
  const orden = [...valores].sort((a, b) => a - b);
  const indice = Math.min(orden.length - 1, Math.ceil(p * orden.length) - 1);
  return orden[Math.max(0, indice)];
}

export class MedidorFrames {
  private readonly buffer: FrameRegistrado[] = [];
  private total = 0;
  private largos = 0;
  private readonly marcas: MarcaRegistrada[] = [];

  constructor(private readonly ahora: () => number = () => performance.now()) {}

  registrarFrame(deltaMs: number): void {
    this.buffer.push({ t: this.ahora(), delta: deltaMs });
    if (this.buffer.length > CAPACIDAD_FRAMES) {
      this.buffer.shift();
    }
    this.total++;
    if (deltaMs > UMBRAL_FRAME_LARGO_MS) {
      this.largos++;
    }
  }

  marcar(nombre: MarcaRendimiento): void {
    this.marcas.push({ nombre, t: this.ahora(), frame: this.total });
    if (this.marcas.length > 200) {
      this.marcas.shift();
    }
  }

  // Un frame largo detectado por LoAF cuenta aunque rAF no lo viera entero.
  registrarFrameLargoNativo(): void {
    this.largos++;
  }

  instantanea(): InstantaneaRendimiento {
    const deltas = this.buffer.map((f) => f.delta);
    return {
      frames: this.total,
      framesLargos: this.largos,
      p95: percentil(deltas, 0.95),
      max: deltas.length ? Math.max(...deltas) : 0,
      marcas: [...this.marcas],
      deltas: [...this.buffer],
    };
  }

  // Frames cuya marca de tiempo cae en [desde, hasta] (performance.now()).
  deltasEntre(desde: number, hasta: number): number[] {
    return this.buffer.filter((f) => f.t >= desde && f.t <= hasta).map((f) => f.delta);
  }

  // Suscripción a Long Animation Frames si el navegador la tiene; devuelve la
  // función para cancelarla. Sin soporte no hace nada (WebKit).
  observarFramesLargos(): () => void {
    if (typeof PerformanceObserver === "undefined") {
      return () => undefined;
    }
    const soportado = (PerformanceObserver as unknown as { supportedEntryTypes?: readonly string[] }).supportedEntryTypes;
    if (!soportado?.includes("long-animation-frame")) {
      return () => undefined;
    }
    const observador = new PerformanceObserver((lista) => {
      for (let i = 0; i < lista.getEntries().length; i++) this.registrarFrameLargoNativo();
    });
    observador.observe({ type: "long-animation-frame", buffered: false } as PerformanceObserverInit);
    return () => observador.disconnect();
  }
}
