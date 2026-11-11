import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { INTERVALO_MINIMO_IMPACTO_MS, PATRONES_VIBRACION } from "@/juego/control/vibracion";
import { fijarVibracionActiva, instalarVibracion, obtenerVibracion, reiniciarVibracion, suscribirVibracion, vibrar } from "@/juego/control/vibracionStore";

// vibracion.test.ts prueba el store con un proveedor inyectado. Aquí se prueba
// el otro camino: sin inyección, el store lee navigator, matchMedia,
// localStorage y la visibilidad del documento, como en el navegador.
const g = globalThis as unknown as Record<string, unknown>;
const NAVEGADOR_ORIGINAL = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function fijarNavegador(valor: unknown): void {
  Object.defineProperty(globalThis, "navigator", { value: valor, configurable: true, writable: true });
}

function navegadorTactil(respuesta: () => boolean = () => true) {
  const llamadas: unknown[] = [];
  fijarNavegador({
    maxTouchPoints: 5,
    vibrate: (patron: unknown) => {
      llamadas.push(patron);
      return respuesta();
    },
  });
  return llamadas;
}

// matchMedia de mentira con su propio EventTarget para lanzar «change».
function consultaMovimiento(inicial: boolean) {
  const objetivo = new EventTarget();
  const consulta = Object.assign(objetivo, { matches: inicial });
  return {
    consulta,
    cambiar(valor: boolean) {
      consulta.matches = valor;
      objetivo.dispatchEvent(Object.assign(new Event("change"), { matches: valor }));
    },
  };
}

function documentoFalso(visibilidad: "visible" | "hidden" = "visible") {
  return Object.assign(new EventTarget(), { visibilityState: visibilidad });
}

let bajaInstalacion: () => void = () => undefined;

beforeEach(() => {
  g.localStorage = { getItem: () => null, setItem: () => undefined };
  g.document = documentoFalso();
  g.window = { matchMedia: () => consultaMovimiento(false).consulta };
  reiniciarVibracion(undefined);
});

afterEach(() => {
  bajaInstalacion();
  bajaInstalacion = () => undefined;
  delete g.document;
  delete g.window;
  if (NAVEGADOR_ORIGINAL) Object.defineProperty(globalThis, "navigator", NAVEGADOR_ORIGINAL);
});

describe("vibracionStore sin proveedor inyectado", () => {
  it("usa navigator.vibrate cuando hay pantalla táctil", () => {
    const llamadas = navegadorTactil();
    assert.equal(obtenerVibracion().soportada, true);
    assert.equal(vibrar("impacto"), true);
    assert.deepEqual(llamadas, [PATRONES_VIBRACION.impacto]);
  });

  it("sin pantalla táctil (escritorio con Chrome) no está soportada aunque exista vibrate", () => {
    const llamadas: unknown[] = [];
    fijarNavegador({ maxTouchPoints: 0, vibrate: (p: unknown) => llamadas.push(p) > 0 });
    assert.equal(obtenerVibracion().soportada, false);
    assert.equal(obtenerVibracion().motivoApagada, "no-soportada");
    assert.equal(vibrar("disparo"), false);
    assert.equal(llamadas.length, 0);
  });

  it("sin navigator.vibrate (Safari) no está soportada", () => {
    fijarNavegador({ maxTouchPoints: 5 });
    assert.equal(obtenerVibracion().soportada, false);
    assert.equal(vibrar("remate"), false);
  });

  it("lee el movimiento reducido de matchMedia cuando no está instalado", () => {
    navegadorTactil();
    g.window = { matchMedia: () => consultaMovimiento(true).consulta };
    reiniciarVibracion(undefined);
    const s = obtenerVibracion();
    assert.equal(s.movimientoReducido, true);
    assert.equal(s.activa, false);
    assert.equal(s.motivoApagada, "movimiento-reducido");
  });

  it("sin matchMedia el movimiento reducido se da por falso", () => {
    navegadorTactil();
    g.window = {};
    reiniciarVibracion(undefined);
    assert.equal(obtenerVibracion().movimientoReducido, false);
  });

  it("la preferencia guardada «0» la apaga", () => {
    navegadorTactil();
    g.localStorage = { getItem: () => "0", setItem: () => undefined };
    reiniciarVibracion(undefined);
    assert.equal(obtenerVibracion().preferencia, false);
    assert.equal(obtenerVibracion().motivoApagada, "preferencia");
  });

  it("con el documento oculto no vibra", () => {
    const llamadas = navegadorTactil();
    g.document = documentoFalso("hidden");
    assert.equal(vibrar("disparo"), false);
    assert.equal(llamadas.length, 0);
  });

  it("dos impactos seguidos vibran una sola vez; el remate no tiene esa espera", () => {
    const llamadas = navegadorTactil();
    assert.equal(vibrar("impacto"), true);
    assert.equal(vibrar("impacto"), false, `antes de ${INTERVALO_MINIMO_IMPACTO_MS} ms`);
    assert.equal(vibrar("remate"), true);
    assert.equal(llamadas.length, 2);
    // El impacto descartado por el ritmo no cuenta como rechazado por el navegador.
    assert.equal(obtenerVibracion().descartadas, 0);
  });

  it("guarda solo las últimas 50 llamadas", () => {
    navegadorTactil();
    for (let i = 0; i < 60; i++) vibrar("disparo");
    assert.equal(obtenerVibracion().llamadas.length, 50);
  });

  it("encender la vibración cuando ya estaba encendida no repite el pulso de prueba", () => {
    const llamadas = navegadorTactil();
    fijarVibracionActiva(true);
    assert.equal(llamadas.length, 0);
  });

  it("con el almacenamiento bloqueado la elección vale en esta sesión", () => {
    navegadorTactil();
    g.localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    reiniciarVibracion(undefined);
    fijarVibracionActiva(false);
    assert.equal(obtenerVibracion().preferencia, false);
  });

  it("la instantánea se reutiliza hasta el siguiente aviso", () => {
    navegadorTactil();
    let avisos = 0;
    const baja = suscribirVibracion(() => avisos++);
    try {
      const a = obtenerVibracion();
      assert.equal(obtenerVibracion(), a);
      vibrar("disparo");
      assert.equal(avisos, 1);
      assert.notEqual(obtenerVibracion(), a);
    } finally {
      baja();
    }
  });
});

describe("instalarVibracion", () => {
  it("sigue los cambios de movimiento reducido y de visibilidad, y expone la instantánea", () => {
    navegadorTactil();
    const movimiento = consultaMovimiento(false);
    const documento = documentoFalso();
    g.document = documento;
    const ventana: { matchMedia: () => unknown; __debug?: { vibracion?: () => unknown } } = { matchMedia: () => movimiento.consulta };
    g.window = ventana;
    let avisos = 0;
    const baja = suscribirVibracion(() => avisos++);
    try {
      bajaInstalacion = instalarVibracion();
      assert.equal(ventana.__debug?.vibracion, obtenerVibracion);
      assert.equal(obtenerVibracion().activa, true);

      movimiento.cambiar(true);
      assert.equal(obtenerVibracion().movimientoReducido, true);
      assert.equal(obtenerVibracion().activa, false);
      movimiento.cambiar(false);
      assert.equal(obtenerVibracion().activa, true);

      const antes = avisos;
      documento.dispatchEvent(new Event("visibilitychange"));
      assert.equal(avisos, antes + 1);
    } finally {
      baja();
    }
  });

  it("instalar dos veces no duplica oyentes y la baja permite volver a instalar", () => {
    navegadorTactil();
    let consultas = 0;
    g.window = {
      matchMedia: () => {
        consultas++;
        return consultaMovimiento(false).consulta;
      },
    };
    const primera = instalarVibracion();
    const segunda = instalarVibracion();
    assert.equal(consultas, 1);
    segunda();
    primera();
    bajaInstalacion = instalarVibracion();
    assert.equal(consultas, 2);
  });

  it("tras la baja ya no sigue los cambios de movimiento reducido", () => {
    navegadorTactil();
    const movimiento = consultaMovimiento(false);
    g.window = { matchMedia: () => movimiento.consulta };
    instalarVibracion()();
    let avisos = 0;
    const baja = suscribirVibracion(() => avisos++);
    try {
      movimiento.cambiar(true);
      assert.equal(avisos, 0);
    } finally {
      baja();
    }
  });

  it("sin documento (servidor) no instala nada", () => {
    delete g.document;
    const baja = instalarVibracion();
    assert.equal(typeof baja, "function");
    baja();
  });
});
