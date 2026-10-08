// respuesta-200ms: lo que importa al jugador es cuánto tarda la pantalla en
// reaccionar a su toque. Event Timing lo da donde existe; la medida propia
// (marca del evento, inicio del manejador y siguiente frame pintado) funciona
// también en WebKit, el motor del iPad. Solo lee: no toca la simulación.

export interface InteraccionRegistrada {
  readonly tipo: string;
  readonly objetivo: string;
  // Desde que el navegador recibió el evento hasta que arrancó el primer manejador.
  readonly retrasoEntrada: number;
  // Desde el evento hasta el siguiente frame pintado.
  readonly duracion: number;
}

export interface InstantaneaRespuesta {
  readonly interacciones: readonly InteraccionRegistrada[];
  // Peor duración observada (INP con menos de 50 interacciones).
  readonly inp: number;
}

export const CAPACIDAD_INTERACCIONES = 200;
const TIPOS_MEDIDOS = ["pointerdown", "click", "keydown"] as const;

function describirObjetivo(objetivo: EventTarget | null): string {
  if (!(objetivo instanceof Element)) return "desconocido";
  const id = objetivo.getAttribute("data-testid") ?? objetivo.getAttribute("aria-label") ?? objetivo.id;
  return id ? `${objetivo.tagName.toLowerCase()}[${id}]` : objetivo.tagName.toLowerCase();
}

export class MedidorRespuesta {
  private readonly lista: InteraccionRegistrada[] = [];
  private inpNativo = 0;

  registrar(interaccion: InteraccionRegistrada): void {
    this.lista.push(interaccion);
    if (this.lista.length > CAPACIDAD_INTERACCIONES) this.lista.shift();
  }

  registrarNativa(duracion: number): void {
    this.inpNativo = Math.max(this.inpNativo, duracion);
  }

  instantanea(): InstantaneaRespuesta {
    const propio = this.lista.reduce((max, i) => Math.max(max, i.duracion), 0);
    return { interacciones: [...this.lista], inp: Math.max(propio, this.inpNativo) };
  }

  // Escucha en captura sobre la ventana: es el primer manejador que corre, así
  // que `inicio` es el retraso de entrada real y no el de un manejador ajeno.
  observar(ventana: Window = window): () => void {
    const alEvento = (evento: Event): void => {
      const inicio = performance.now();
      const marca = evento.timeStamp;
      const tipo = evento.type;
      const objetivo = describirObjetivo(evento.target);
      ventana.requestAnimationFrame(() => {
        // El frame se pinta tras el rAF: el setTimeout(0) cae después del pintado.
        ventana.setTimeout(() => {
          this.registrar({ tipo, objetivo, retrasoEntrada: Math.max(0, inicio - marca), duracion: Math.max(0, performance.now() - marca) });
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
    return () => {
      for (const tipo of TIPOS_MEDIDOS) ventana.removeEventListener(tipo, alEvento, { capture: true });
      observador?.disconnect();
    };
  }
}
