import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { comprobarActualizacion, pulsarRecargar, type EntornoCiclo, type SerwistVentana } from "@/juego/pwa/ciclo";
import { despacharPwa, obtenerDatosPwa } from "@/juego/pwa/estadoPwa";

function crearSw(update: () => Promise<void>) {
  const f = { saltos: 0 };
  const sw = {
    addEventListener: () => undefined,
    register: async () => undefined,
    update,
    messageSkipWaiting: () => void f.saltos++,
  } as unknown as SerwistVentana;
  return { sw, f };
}

function entorno(enLinea: boolean): EntornoCiclo {
  return { enLinea: () => enLinea, almacenamiento: undefined, recargar: () => undefined };
}

const falla = crearSw(async () => {
  throw new Error("red");
}).sw;
const funciona = crearSw(async () => undefined).sw;

// El estado PWA es un singleton de módulo sin reinicio: los casos van en
// orden y cada uno parte de donde dejó el anterior.
describe("ciclo PWA: comprobar actualización y recargar", () => {
  it("una comprobación fallida sin red se distingue de una con red", async () => {
    despacharPwa({ tipo: "instalado", esActualizacion: false });
    assert.equal(obtenerDatosPwa().estado, "listo-sin-conexion");
    await comprobarActualizacion(falla, entorno(false));
    assert.equal(obtenerDatosPwa().estado, "comprobacion-fallida-sin-red");
    await comprobarActualizacion(falla, entorno(true));
    assert.equal(obtenerDatosPwa().estado, "comprobacion-fallida");
  });

  it("una comprobación correcta tras el fallo vuelve a «listo»", async () => {
    await comprobarActualizacion(funciona, entorno(true));
    assert.equal(obtenerDatosPwa().estado, "listo-sin-conexion");
  });

  it("con una versión esperando, la comprobación correcta tras un fallo vuelve a «versión nueva»", async () => {
    despacharPwa({ tipo: "esperando" });
    await comprobarActualizacion(falla, entorno(true));
    await comprobarActualizacion(funciona, entorno(true));
    assert.equal(obtenerDatosPwa().estado, "version-nueva");
  });

  it("Recargar anota la recarga pedida y manda saltar la espera al worker", () => {
    const { sw, f } = crearSw(async () => undefined);
    assert.equal(obtenerDatosPwa().recargaPedida, false);
    pulsarRecargar(sw);
    assert.equal(obtenerDatosPwa().recargaPedida, true);
    assert.equal(f.saltos, 1);
  });
});
