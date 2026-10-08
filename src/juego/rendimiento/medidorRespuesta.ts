// respuesta-200ms: lo que importa al jugador es cuánto tarda la pantalla en
// reaccionar a su toque. Event Timing lo da donde existe; la medida propia
// (marca del evento, inicio del manejador y siguiente frame pintado) funciona
// también en WebKit, el motor del iPad. Solo lee: no toca la simulación.
//
// trabajoApp es lo que juzga el CI (ver trabajoApp.ts): el JS de la app sin el
// render de Phaser, más el estilo y la maquetación por encima de un fotograma
// en reposo. La duración completa, con el pintado real, se juzga en el
// dispositivo con ?rendimiento=1.

import { percentil } from "@/juego/rendimiento/medidorFrames";
import { calcularBaseMaquetacion, calcularRenderLienzo, calcularTrabajoApp, type FotogramaLoaf, type Intervalo } from "@/juego/rendimiento/trabajoApp";

export interface InteraccionRegistrada {
  readonly tipo: string;
  readonly objetivo: string;
  // Desde que el navegador recibió el evento hasta que arrancó el primer manejador.
  readonly retrasoEntrada: number;
  // Desde el evento hasta el siguiente frame pintado.
  readonly duracion: number;
  // Ventana [marca del evento, siguiente frame pintado] en performance.now().
  readonly inicio?: number;
  readonly fin?: number;
  // Lo que tardaron los manejadores síncronos; sirve cuando no hay LoAF porque
  // ninguna tarea llegó a 50 ms.
  readonly manejador?: number;
}

export interface InteraccionMedida extends InteraccionRegistrada {
  // null si el navegador no tiene Long Animation Frames (WebKit, Firefox).
  readonly trabajoApp: number | null;
  readonly renderLienzo: number;
}

export interface InstantaneaRespuesta {
  readonly interacciones: readonly InteraccionMedida[];
  // Peor duración observada (INP con menos de 50 interacciones).
  readonly inp: number;
  readonly baseMaquetacion: number;
  // Percentiles del render de Phaser por fotograma (ms).
  readonly renderLienzoFrames: { readonly p50: number; readonly p95: number; readonly max: number };
}

export const CAPACIDAD_INTERACCIONES = 200;
export const CAPACIDAD_FOTOGRAMAS = 600;
const TIPOS_MEDIDOS = ["pointerdown", "click", "keydown"] as const;

function describirObjetivo(objetivo: EventTarget | null): string {
  if (!(objetivo instanceof Element)) return "desconocido";
  const id = objetivo.getAttribute("data-testid") ?? objetivo.getAttribute("aria-label") ?? objetivo.id;
  return id ? `${objetivo.tagName.toLowerCase()}[${id}]` : objetivo.tagName.toLowerCase();
}

export class MedidorRespuesta {
  private readonly lista: InteraccionRegistrada[] = [];
  private inpNativo = 0;
  private readonly fotogramas: FotogramaLoaf[] = [];
  private readonly renders: Intervalo[] = [];
  private inicioRender: number | null = null;
  private observadorLoaf: PerformanceObserver | null = null;
  private hayLoaf = false;
  private bloqueoPendiente = 0;

  // Centinela de la medida: el siguiente toque ejecuta un bucle síncrono dentro
  // de su manejador. Demuestra que trabajoApp caza un bloqueo real. Tope de
  // 1000 ms y se consume en un solo toque.
  bloquearHilo(ms: number): void {
    this.bloqueoPendiente = Math.max(0, Math.min(1000, ms));
  }

  // Phaser: PRE_RENDER y POST_RENDER delimitan lo que cuesta pintar el lienzo.
  marcarInicioRender(t: number = performance.now()): void {
    this.inicioRender = t;
  }

  marcarFinRender(t: number = performance.now()): void {
    if (this.inicioRender === null) return;
    this.renders.push({ inicio: this.inicioRender, fin: t });
    if (this.renders.length > CAPACIDAD_FOTOGRAMAS) this.renders.shift();
    this.inicioRender = null;
  }

  registrarFotogramaLoaf(f: FotogramaLoaf): void {
    this.fotogramas.push(f);
    if (this.fotogramas.length > CAPACIDAD_FOTOGRAMAS) this.fotogramas.shift();
  }

  private absorberLoaf(): void {
    if (!this.observadorLoaf) return;
    for (const e of this.observadorLoaf.takeRecords()) this.registrarEntradaLoaf(e);
  }

  private registrarEntradaLoaf(e: PerformanceEntry): void {
    const loaf = e as PerformanceEntry & { styleAndLayoutStart?: number; scripts?: readonly { startTime: number; duration: number }[] };
    this.registrarFotogramaLoaf({
      inicio: e.startTime,
      fin: e.startTime + e.duration,
      scripts: (loaf.scripts ?? []).map((s) => ({ inicio: s.startTime, duracion: s.duration })),
      inicioEstiloMaquetacion: loaf.styleAndLayoutStart ?? 0,
    });
  }

  registrar(interaccion: InteraccionRegistrada): void {
    this.lista.push(interaccion);
    if (this.lista.length > CAPACIDAD_INTERACCIONES) this.lista.shift();
  }

  registrarNativa(duracion: number): void {
    this.inpNativo = Math.max(this.inpNativo, duracion);
  }

  instantanea(): InstantaneaRespuesta {
    this.absorberLoaf();
    const propio = this.lista.reduce((max, i) => Math.max(max, i.duracion), 0);
    const ventanas: Intervalo[] = this.lista.filter((i) => i.inicio !== undefined && i.fin !== undefined).map((i) => ({ inicio: i.inicio!, fin: i.fin! }));
    const base = calcularBaseMaquetacion(this.fotogramas, ventanas);
    const interacciones = this.lista.map((i): InteraccionMedida => {
      if (i.inicio === undefined || i.fin === undefined) return { ...i, trabajoApp: null, renderLienzo: 0 };
      const ventana = { inicio: i.inicio, fin: i.fin };
      const renderLienzo = calcularRenderLienzo(ventana, this.renders);
      if (!this.hayLoaf) return { ...i, trabajoApp: null, renderLienzo };
      const hayEntrada = this.fotogramas.some((f) => f.inicio < ventana.fin && ventana.inicio < f.fin);
      // Sin ninguna entrada LoAF en la ventana todas las tareas duraron < 50 ms:
      // vale lo que midió el manejador.
      const trabajoApp = hayEntrada ? calcularTrabajoApp(ventana, this.fotogramas, this.renders, base) : (i.manejador ?? 0);
      return { ...i, trabajoApp, renderLienzo };
    });
    const duraciones = this.renders.map((r) => r.fin - r.inicio);
    return {
      interacciones,
      inp: Math.max(propio, this.inpNativo),
      baseMaquetacion: base,
      renderLienzoFrames: { p50: percentil(duraciones, 0.5), p95: percentil(duraciones, 0.95), max: duraciones.length ? Math.max(...duraciones) : 0 },
    };
  }

  // Escucha en captura sobre la ventana: es el primer manejador que corre, así
  // que `inicio` es el retraso de entrada real y no el de un manejador ajeno.
  observar(ventana: Window = window): () => void {
    const alEvento = (evento: Event): void => {
      const inicio = performance.now();
      const marca = evento.timeStamp;
      let manejador = 0;
      if (this.bloqueoPendiente > 0) {
        const hasta = performance.now() + this.bloqueoPendiente;
        this.bloqueoPendiente = 0;
        while (performance.now() < hasta) {
          // espera activa a propósito
        }
      }
      // El oyente de burbujeo en la ventana corre tras los manejadores del
      // objetivo y de React; la diferencia es lo que tardaron, síncronos.
      ventana.addEventListener(evento.type, () => (manejador = performance.now() - inicio), { once: true, passive: true });
      const tipo = evento.type;
      const objetivo = describirObjetivo(evento.target);
      ventana.requestAnimationFrame(() => {
        // El frame se pinta tras el rAF: el setTimeout(0) cae después del pintado.
        ventana.setTimeout(() => {
          const fin = performance.now();
          this.registrar({ tipo, objetivo, retrasoEntrada: Math.max(0, inicio - marca), duracion: Math.max(0, fin - marca), inicio: marca, fin, manejador });
        }, 0);
      });
    };
    for (const tipo of TIPOS_MEDIDOS) ventana.addEventListener(tipo, alEvento, { capture: true, passive: true });

    let observador: PerformanceObserver | null = null;
    const soportado = (PerformanceObserver as unknown as { supportedEntryTypes?: readonly string[] }).supportedEntryTypes;
    if (typeof PerformanceObserver !== "undefined" && soportado?.includes("event")) {
      observador = new PerformanceObserver((lista) => {
        for (const entrada of lista.getEntries()) {
          if ((entrada as PerformanceEventTiming & { interactionId?: number }).interactionId) this.registrarNativa(entrada.duration);
        }
      });
      observador.observe({ type: "event", durationThreshold: 16, buffered: false } as PerformanceObserverInit);
    }
    if (typeof PerformanceObserver !== "undefined" && soportado?.includes("long-animation-frame")) {
      this.hayLoaf = true;
      this.observadorLoaf = new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) this.registrarEntradaLoaf(e);
      });
      this.observadorLoaf.observe({ type: "long-animation-frame", buffered: false } as PerformanceObserverInit);
    }
    return () => {
      for (const tipo of TIPOS_MEDIDOS) ventana.removeEventListener(tipo, alEvento, { capture: true });
      observador?.disconnect();
      this.observadorLoaf?.disconnect();
    };
  }
}
