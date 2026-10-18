import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { borrarPartidaGuardada, CLAVE_GUARDADO_ACTIVADO, CLAVE_PARTIDA_GUARDADA, guardadoActivado, escribirPartidaGuardada, leerPartidaGuardada } from "@/juego/partidaGuardada/almacen";
import { MAX_CARACTERES_INSTANTANEA } from "@/juego/partidaGuardada/tipos";

function almacenFalso(alEscribir?: () => never): Storage & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => Array.from(datos.keys())[i] ?? null,
    removeItem: (k) => void datos.delete(k),
    setItem: (k, v) => {
      if (alEscribir) alEscribir();
      datos.set(k, v);
    },
  };
}

const global = globalThis as unknown as { window?: unknown };

describe("pgn-5: el almacén informa de sus fallos y no toca otras claves", () => {
  beforeEach(() => {
    delete global.window;
  });
  afterEach(() => {
    delete global.window;
  });

  it("sin localStorage: 'sin-almacenamiento'", () => {
    assert.deepEqual(escribirPartidaGuardada("{}"), { ok: false, motivo: "sin-almacenamiento" });
    assert.equal(leerPartidaGuardada(), null);
    assert.equal(borrarPartidaGuardada(), true);
  });

  it("acceder a localStorage lanza (modo privado estricto): 'sin-almacenamiento'", () => {
    global.window = {
      get localStorage(): Storage {
        throw new Error("SecurityError");
      },
    };
    assert.deepEqual(escribirPartidaGuardada("{}"), { ok: false, motivo: "sin-almacenamiento" });
  });

  it("QuotaExceededError al escribir: 'sin-espacio', el progreso queda intacto y no hay clave parcial", () => {
    const almacen = almacenFalso(() => {
      throw new DOMException("cuota", "QuotaExceededError");
    });
    almacen.datos.set("partida-completa:progreso", "PROGRESO");
    global.window = { localStorage: almacen };
    assert.deepEqual(escribirPartidaGuardada("{}"), { ok: false, motivo: "sin-espacio" });
    assert.deepEqual(Array.from(almacen.datos.keys()), ["partida-completa:progreso"]);
    assert.equal(almacen.datos.get("partida-completa:progreso"), "PROGRESO");
  });

  it("más de 1 MB: 'demasiado-grande' sin llegar a escribir", () => {
    const almacen = almacenFalso();
    global.window = { localStorage: almacen };
    assert.deepEqual(escribirPartidaGuardada("x".repeat(MAX_CARACTERES_INSTANTANEA + 1)), { ok: false, motivo: "demasiado-grande" });
    assert.equal(almacen.datos.size, 0);
  });

  it("escribe, lee y borra solo su clave", () => {
    const almacen = almacenFalso();
    almacen.datos.set("partida-completa:progreso", "PROGRESO");
    global.window = { localStorage: almacen };
    assert.deepEqual(escribirPartidaGuardada("{\"a\":1}"), { ok: true });
    assert.equal(leerPartidaGuardada(), "{\"a\":1}");
    assert.equal(borrarPartidaGuardada(), true);
    assert.deepEqual(Array.from(almacen.datos.keys()), ["partida-completa:progreso"]);
    assert.equal(CLAVE_PARTIDA_GUARDADA, "partida-completa:partida-guardada");
  });
});

describe("interruptor de pruebas del guardado", () => {
  afterEach(() => {
    delete global.window;
  });

  it("solo el valor «0» lo apaga; sin almacenamiento sigue activo", () => {
    assert.equal(guardadoActivado(), true);
    const almacen = almacenFalso();
    global.window = { localStorage: almacen };
    assert.equal(guardadoActivado(), true);
    almacen.datos.set(CLAVE_GUARDADO_ACTIVADO, "0");
    assert.equal(guardadoActivado(), false);
    almacen.datos.set(CLAVE_GUARDADO_ACTIVADO, "1");
    assert.equal(guardadoActivado(), true);
  });
});
