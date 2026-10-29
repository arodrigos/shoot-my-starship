import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { observarTareasLargas, reiniciarTareasLargas, tareasLargasActuales } from "@/juego/rendimiento/tareasLargas";

type Retrollamada = (lista: { getEntries(): { duration: number }[] }) => void;

const global = globalThis as unknown as { PerformanceObserver?: unknown };
const ORIGINAL = global.PerformanceObserver;

// Observador falso: guarda la retrollamada para poder entregarle entradas a
// mano, como haría el navegador al detectar una tarea larga.
function instalarObservador(tipos: readonly string[] | undefined) {
  const registro = { retrollamada: null as Retrollamada | null, observado: null as unknown, desconectado: false };
  class ObservadorFalso {
    static supportedEntryTypes = tipos;
    constructor(retrollamada: Retrollamada) {
      registro.retrollamada = retrollamada;
    }
    observe(opciones: unknown) {
      registro.observado = opciones;
    }
    disconnect() {
      registro.desconectado = true;
    }
  }
  global.PerformanceObserver = ObservadorFalso;
  return registro;
}

describe("tareasLargas", () => {
  afterEach(() => {
    global.PerformanceObserver = ORIGINAL;
    reiniciarTareasLargas();
  });

  it("sin PerformanceObserver: no observa y las medidas se quedan a cero", () => {
    delete global.PerformanceObserver;
    const dejar = observarTareasLargas();
    assert.doesNotThrow(dejar);
    assert.deepEqual(tareasLargasActuales(), { maxMs: 0, cuenta: 0 });
  });

  it("sin soporte de 'longtask' tampoco observa", () => {
    const registro = instalarObservador(["mark", "measure"]);
    observarTareasLargas();
    assert.equal(registro.retrollamada, null);
    instalarObservador(undefined);
    assert.doesNotThrow(() => observarTareasLargas()());
  });

  it("cuenta las tareas y guarda la más larga; reiniciar vuelve a cero", () => {
    const registro = instalarObservador(["longtask"]);
    const dejar = observarTareasLargas();
    assert.deepEqual(registro.observado, { type: "longtask", buffered: false });
    registro.retrollamada?.({ getEntries: () => [{ duration: 60 }, { duration: 120 }] });
    registro.retrollamada?.({ getEntries: () => [{ duration: 80 }] });
    assert.deepEqual(tareasLargasActuales(), { maxMs: 120, cuenta: 3 });
    reiniciarTareasLargas();
    assert.deepEqual(tareasLargasActuales(), { maxMs: 0, cuenta: 0 });
    dejar();
    assert.equal(registro.desconectado, true);
  });
});
