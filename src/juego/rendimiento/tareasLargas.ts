// Tareas largas del hilo principal (PerformanceObserver 'longtask') desde el
// último reinicio, que la escena hace al empezar cada turno. Lo lee
// __debug.tareasLargas para comprobar que cerrar un turno no congela el menú.
export interface TareasLargas {
  readonly maxMs: number;
  readonly cuenta: number;
}

let maxMs = 0;
let cuenta = 0;

export function reiniciarTareasLargas(): void {
  maxMs = 0;
  cuenta = 0;
}

export function tareasLargasActuales(): TareasLargas {
  return { maxMs, cuenta };
}

// Devuelve cómo dejar de observar; en navegadores sin 'longtask' no observa
// nada y las medidas se quedan a cero.
export function observarTareasLargas(): () => void {
  if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes?.includes("longtask")) return () => undefined;
  const observador = new PerformanceObserver((lista) => {
    for (const entrada of lista.getEntries()) {
      cuenta += 1;
      maxMs = Math.max(maxMs, entrada.duration);
    }
  });
  observador.observe({ type: "longtask", buffered: false });
  return () => observador.disconnect();
}
