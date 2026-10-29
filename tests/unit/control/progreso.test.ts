import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  almacenamientoDisponible,
  guardarNivelElegido,
  guardarRivalElegido,
  guardarUltimaPartida,
  leerProgreso,
} from "@/juego/control/progreso";
import type { EstadisticasPartida } from "@/sim/partida/parteDeGuerra";

const CLAVE = "partida-completa:progreso";

function almacenFalso(opciones: { escribirLanza?: boolean; leerLanza?: boolean } = {}): Storage & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k) => {
      if (opciones.leerLanza) throw new Error("SecurityError");
      return datos.get(k) ?? null;
    },
    key: (i) => Array.from(datos.keys())[i] ?? null,
    removeItem: (k) => void datos.delete(k),
    setItem: (k, v) => {
      if (opciones.escribirLanza) throw new Error("QuotaExceededError");
      datos.set(k, v);
    },
  };
}

const global = globalThis as unknown as { window?: unknown };

function instalar(almacen: Storage): void {
  global.window = { localStorage: almacen };
}

const ESTADISTICAS: EstadisticasPartida = {
  disparos: 7,
  fallos: 2,
  autoimpactos: 1,
  danioHechoAlEnemigo: 140,
  pixelesDestruidos: 3200,
};

describe("progreso: almacenamiento disponible", () => {
  afterEach(() => {
    delete global.window;
  });

  it("sin window: no disponible", () => {
    delete global.window;
    assert.equal(almacenamientoDisponible(), false);
  });

  it("escribir lanza (cuota, modo privado estricto): no disponible", () => {
    instalar(almacenFalso({ escribirLanza: true }));
    assert.equal(almacenamientoDisponible(), false);
  });

  it("con almacén sano: disponible y el sondeo no deja rastro", () => {
    const almacen = almacenFalso();
    instalar(almacen);
    assert.equal(almacenamientoDisponible(), true);
    assert.equal(almacen.datos.size, 0);
  });
});

describe("progreso: lectura tolerante", () => {
  let almacen: ReturnType<typeof almacenFalso>;
  beforeEach(() => {
    almacen = almacenFalso();
    instalar(almacen);
  });
  afterEach(() => {
    delete global.window;
  });

  const VACIO = { version: 1, rivalId: null, nivelIA: null, ultimaPartida: null };

  it("sin nada guardado: progreso vacío", () => {
    assert.deepEqual(leerProgreso(), VACIO);
  });

  it("sin window: progreso vacío, sin lanzar", () => {
    delete global.window;
    assert.deepEqual(leerProgreso(), VACIO);
  });

  it("leer lanza: progreso vacío", () => {
    instalar(almacenFalso({ leerLanza: true }));
    assert.deepEqual(leerProgreso(), VACIO);
  });

  it("JSON corrupto: progreso vacío", () => {
    almacen.datos.set(CLAVE, "{no es json");
    assert.deepEqual(leerProgreso(), VACIO);
  });

  it("descarta en silencio lo que no valida el esquema", () => {
    const invalidos: unknown[] = [
      null,
      42,
      "texto",
      { version: 2, rivalId: null, ultimaPartida: null },
      { version: 1, rivalId: 7, ultimaPartida: null },
      { version: 1, rivalId: null, ultimaPartida: "x" },
      { version: 1, rivalId: null, ultimaPartida: { medalla: 1, texto: "t", estadisticas: ESTADISTICAS } },
      { version: 1, rivalId: null, ultimaPartida: { medalla: "m", texto: null, estadisticas: ESTADISTICAS } },
      { version: 1, rivalId: null, ultimaPartida: { medalla: "m", texto: "t", estadisticas: null } },
      { version: 1, rivalId: null, ultimaPartida: { medalla: "m", texto: "t", estadisticas: { ...ESTADISTICAS, fallos: "2" } } },
    ];
    for (const valor of invalidos) {
      almacen.datos.set(CLAVE, JSON.stringify(valor));
      assert.deepEqual(leerProgreso(), VACIO, JSON.stringify(valor));
    }
  });

  it("un nivel ausente o manipulado cae a «sin elegir» sin perder el resto", () => {
    almacen.datos.set(CLAVE, JSON.stringify({ version: 1, rivalId: "chispa", ultimaPartida: null }));
    assert.deepEqual(leerProgreso(), { version: 1, rivalId: "chispa", nivelIA: null, ultimaPartida: null });
    almacen.datos.set(CLAVE, JSON.stringify({ version: 1, rivalId: "chispa", nivelIA: "imposible", ultimaPartida: null }));
    assert.equal(leerProgreso().nivelIA, null);
    assert.equal(leerProgreso().rivalId, "chispa");
  });

  it("un progreso válido se devuelve tal cual", () => {
    const valido = {
      version: 1,
      rivalId: "contable",
      nivelIA: "dificil",
      ultimaPartida: { medalla: "Oro", texto: "Bien", estadisticas: ESTADISTICAS },
    };
    almacen.datos.set(CLAVE, JSON.stringify(valido));
    assert.deepEqual(leerProgreso(), valido);
  });
});

describe("progreso: escritura acumulativa", () => {
  let almacen: ReturnType<typeof almacenFalso>;
  beforeEach(() => {
    almacen = almacenFalso();
    instalar(almacen);
  });
  afterEach(() => {
    delete global.window;
  });

  it("rival, nivel y última partida se guardan sin pisarse entre sí", () => {
    guardarRivalElegido("bisagra");
    guardarNivelElegido("facil");
    guardarUltimaPartida({ medalla: "Chatarrero", texto: "Ganaste" }, ESTADISTICAS);
    assert.deepEqual(leerProgreso(), {
      version: 1,
      rivalId: "bisagra",
      nivelIA: "facil",
      ultimaPartida: { medalla: "Chatarrero", texto: "Ganaste", estadisticas: ESTADISTICAS },
    });
    guardarRivalElegido("chispa");
    assert.equal(leerProgreso().rivalId, "chispa");
    assert.equal(leerProgreso().nivelIA, "facil");
  });

  it("solo escribe en su propia clave", () => {
    almacen.datos.set("otra", "intacta");
    guardarNivelElegido("normal");
    assert.deepEqual([...almacen.datos.keys()].sort(), [CLAVE, "otra"].sort());
    assert.equal(almacen.datos.get("otra"), "intacta");
  });

  it("si escribir lanza, guardar no rompe nada", () => {
    instalar(almacenFalso({ escribirLanza: true }));
    assert.doesNotThrow(() => guardarRivalElegido("chispa"));
    assert.doesNotThrow(() => guardarNivelElegido("dificil"));
    assert.doesNotThrow(() => guardarUltimaPartida({ medalla: "m", texto: "t" }, ESTADISTICAS));
  });
});
