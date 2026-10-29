import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  instalarPantallaEncendida,
  obtenerPantallaEncendida,
  marcarPartidaEnCurso,
  reiniciarPantallaEncendida,
  type CentinelaBloqueo,
  type ProveedorBloqueo,
} from "@/juego/control/pantallaEncendidaStore";
import { limpiarParteDeGuerra, publicarParteDeGuerra, solicitarOtraPartida } from "@/juego/control/parteDeGuerraStore";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;

const ESTADISTICAS = { disparos: 1, fallos: 0, autoimpactos: 0, danioHechoAlEnemigo: 0, pixelesDestruidos: 0 };

// Proveedor que concede al momento; cuenta peticiones y centinelas vivos.
function proveedorInmediato() {
  const f = { vivos: 0 };
  const proveedor: ProveedorBloqueo = {
    async request() {
      f.vivos++;
      let vivo = true;
      const centinela: CentinelaBloqueo = {
        async release() {
          if (vivo) f.vivos--;
          vivo = false;
        },
        addEventListener() {},
      };
      return centinela;
    },
  };
  return { proveedor, f };
}

const esperar = () => new Promise((resolver) => setImmediate(resolver));

function fijarVisibilidad(estado: "visible" | "hidden"): void {
  Object.defineProperty(dom.window.document, "visibilityState", { value: estado, configurable: true });
  dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));
}

describe("instalarPantallaEncendida", () => {
  let baja: () => void = () => undefined;
  beforeEach(() => {
    limpiarParteDeGuerra();
    fijarVisibilidad("visible");
  });
  afterEach(() => {
    baja();
    marcarPartidaEnCurso(false);
    reiniciarPantallaEncendida();
  });

  it("es idempotente y expone el gancho de depuración", () => {
    reiniciarPantallaEncendida(proveedorInmediato().proveedor);
    baja = instalarPantallaEncendida();
    const segunda = instalarPantallaEncendida();
    segunda();
    const debug = (dom.window as unknown as { __debug: { pantallaEncendida: () => unknown } }).__debug;
    assert.deepEqual(debug.pantallaEncendida(), obtenerPantallaEncendida());
  });

  it("ocultar la página suelta el bloqueo y volver a verla lo pide de nuevo", async () => {
    const { proveedor, f } = proveedorInmediato();
    reiniciarPantallaEncendida(proveedor);
    baja = instalarPantallaEncendida();
    marcarPartidaEnCurso(true);
    await esperar();
    assert.equal(obtenerPantallaEncendida().estado, "activo");
    fijarVisibilidad("hidden");
    await esperar();
    assert.equal(obtenerPantallaEncendida().estado, "soltado");
    assert.equal(f.vivos, 0);
    fijarVisibilidad("visible");
    await esperar();
    assert.equal(obtenerPantallaEncendida().estado, "activo");
    assert.equal(obtenerPantallaEncendida().peticiones, 2);
  });

  it("el parte de guerra suelta el bloqueo; «Otra partida» lo vuelve a pedir", async () => {
    const { proveedor, f } = proveedorInmediato();
    reiniciarPantallaEncendida(proveedor);
    baja = instalarPantallaEncendida();
    marcarPartidaEnCurso(true);
    await esperar();
    publicarParteDeGuerra({ medalla: "m", texto: "t" }, ESTADISTICAS);
    publicarParteDeGuerra({ medalla: "m2", texto: "t2" }, ESTADISTICAS);
    await esperar();
    assert.equal(obtenerPantallaEncendida().deseada, false);
    assert.equal(f.vivos, 0);
    solicitarOtraPartida();
    await esperar();
    assert.equal(obtenerPantallaEncendida().deseada, true);
    assert.equal(obtenerPantallaEncendida().estado, "activo");
  });

  it("si al instalar ya hay parte visible, no se desea el bloqueo", () => {
    reiniciarPantallaEncendida(proveedorInmediato().proveedor);
    publicarParteDeGuerra({ medalla: "m", texto: "t" }, ESTADISTICAS);
    baja = instalarPantallaEncendida();
    marcarPartidaEnCurso(true);
    assert.equal(obtenerPantallaEncendida().deseada, false);
    assert.equal(obtenerPantallaEncendida().peticiones, 0);
  });

  it("un toque en partida reintenta tras un rechazo", async () => {
    let concede = false;
    const proveedor: ProveedorBloqueo = {
      async request() {
        if (!concede) throw new Error("NotAllowedError");
        return { async release() {}, addEventListener() {} };
      },
    };
    reiniciarPantallaEncendida(proveedor);
    baja = instalarPantallaEncendida();
    marcarPartidaEnCurso(true);
    await esperar();
    assert.equal(obtenerPantallaEncendida().estado, "rechazado");
    concede = true;
    dom.window.document.dispatchEvent(new dom.window.Event("pointerdown"));
    await esperar();
    assert.equal(obtenerPantallaEncendida().estado, "activo");
  });

  it("tras la baja deja de escuchar al documento", async () => {
    const { proveedor } = proveedorInmediato();
    reiniciarPantallaEncendida(proveedor);
    baja = instalarPantallaEncendida();
    marcarPartidaEnCurso(true);
    await esperar();
    baja();
    baja = () => undefined;
    fijarVisibilidad("hidden");
    await esperar();
    assert.equal(obtenerPantallaEncendida().estado, "activo");
  });
});
