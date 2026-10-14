import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  avisoVersionVisible,
  DATOS_PWA_INICIALES,
  reducirEstadoPwa,
  type DatosPwa,
  type EventoPwa,
} from "@/juego/pwa/estadoPwa";

const evento: fc.Arbitrary<EventoPwa> = fc.oneof(
  fc.constant<EventoPwa>({ tipo: "registrando" }),
  fc.constant<EventoPwa>({ tipo: "registro-fallido" }),
  fc.boolean().map((esActualizacion): EventoPwa => ({ tipo: "instalado", esActualizacion })),
  fc.constant<EventoPwa>({ tipo: "esperando" }),
  fc.constant<EventoPwa>({ tipo: "controlando" }),
  fc.boolean().map((conRed): EventoPwa => ({ tipo: "fallo-comprobacion", conRed })),
  fc.constant<EventoPwa>({ tipo: "comprobacion-ok" }),
  fc.constant<EventoPwa>({ tipo: "luego" }),
  fc.constant<EventoPwa>({ tipo: "recargar" }),
  fc.constant<EventoPwa>({ tipo: "aviso-listo-visto" }),
);
const secuencia = fc.array(evento, { maxLength: 40 });

function aplicar(eventos: readonly EventoPwa[]): DatosPwa {
  return eventos.reduce(reducirEstadoPwa, DATOS_PWA_INICIALES);
}

test("pwa-2: pide recargar solo si tras el último waiting hay un Recargar", () => {
  fc.assert(fc.property(secuencia, (eventos) => {
    const ultimoWaiting = eventos.map((e) => e.tipo).lastIndexOf("esperando");
    const hayRecargar = eventos.slice(ultimoWaiting + 1).some((e) => e.tipo === "recargar");
    return aplicar(eventos).recargaPedida === hayRecargar;
  }));
});

test("pwa-2: el aviso es visible si y solo si hay un SW en espera no pospuesto en esta carga", () => {
  fc.assert(fc.property(secuencia, (eventos) => {
    let esperando = false;
    for (const e of eventos) {
      if (e.tipo === "esperando") esperando = true;
      if (e.tipo === "controlando") esperando = false;
    }
    const pospuesto = eventos.some((e) => e.tipo === "luego");
    return avisoVersionVisible(aplicar(eventos)) === (esperando && !pospuesto);
  }));
});

test("pwa-4: un fallo de comprobación con red es comprobacion-fallida, sin red es la variante sin red", () => {
  fc.assert(fc.property(secuencia, fc.boolean(), (eventos, conRed) => {
    const estado = reducirEstadoPwa(aplicar(eventos), { tipo: "fallo-comprobacion", conRed }).estado;
    return estado === (conRed ? "comprobacion-fallida" : "comprobacion-fallida-sin-red");
  }));
});

test("pwa-5: la primera instalación deja el estado listo y activa el aviso de 4 s; la actualización no", () => {
  const primera = aplicar([{ tipo: "registrando" }, { tipo: "instalado", esActualizacion: false }]);
  assert.equal(primera.estado, "listo-sin-conexion");
  assert.equal(primera.avisoListo, true);
  const actualizacion = aplicar([{ tipo: "registrando" }, { tipo: "instalado", esActualizacion: true }]);
  assert.equal(actualizacion.avisoListo, false);
});

test("pwa-5: con el worker ya controlando la página, 'preparando' pasa a listo y nada más cambia", () => {
  assert.equal(aplicar([{ tipo: "registrando" }, { tipo: "ya-controlado" }]).estado, "listo-sin-conexion");
  const enEspera = aplicar([{ tipo: "registrando" }, { tipo: "esperando" }, { tipo: "ya-controlado" }]);
  assert.equal(enEspera.estado, "version-nueva");
  const fallida = aplicar([{ tipo: "registrando" }, { tipo: "fallo-comprobacion", conRed: true }, { tipo: "ya-controlado" }]);
  assert.equal(fallida.estado, "comprobacion-fallida");
});
