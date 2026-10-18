import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GuardadorPartida } from "@/juego/partidaGuardada/guardador";
import { leerInstantanea } from "@/juego/partidaGuardada/instantanea";
import type { ResultadoEscritura } from "@/juego/partidaGuardada/almacen";
import { datosDe, jugar, partidaInicial } from "./ayudas";

function entorno(resultados: ResultadoEscritura[]) {
  const escrituras: string[] = [];
  let borrados = 0;
  let reloj = 0;
  const avisos: string[] = [];
  const guardador = new GuardadorPartida((motivo) => avisos.push(motivo), {
    escribir: (cadena) => {
      const resultado = resultados.shift() ?? { ok: true };
      if (resultado.ok) escrituras.push(cadena);
      return resultado;
    },
    borrar: () => {
      borrados += 1;
      return true;
    },
    ahora: () => (reloj += 3),
  });
  return { guardador, escrituras, avisos, borrados: () => borrados };
}

function datos(turnos: number) {
  const { estado, memorias } = jugar(partidaInicial(900, 700), turnos);
  return datosDe(estado, memorias);
}

describe("GuardadorPartida", () => {
  it("guarda una instantánea que se puede volver a leer y mide el tiempo", () => {
    const { guardador, escrituras } = entorno([]);
    guardador.guardar(datos(2));
    assert.equal(escrituras.length, 1);
    assert.equal(leerInstantanea(escrituras[0]).tipo, "valida");
    const estado = guardador.estado();
    assert.equal(estado.existe, true);
    assert.equal(estado.error, null);
    assert.equal(estado.ultimoGuardadoMs, 3);
  });

  it("hidden reescribe lo que falló y avisa una sola vez", () => {
    const { guardador, escrituras, avisos } = entorno([{ ok: false, motivo: "sin-espacio" }, { ok: false, motivo: "sin-espacio" }]);
    guardador.guardar(datos(2));
    assert.deepEqual(avisos, ["sin-espacio"]);
    assert.equal(guardador.estado().existe, false);
    guardador.reescribirSiPendiente();
    assert.deepEqual(avisos, ["sin-espacio"]);
    guardador.reescribirSiPendiente();
    assert.equal(escrituras.length, 1);
    assert.equal(guardador.estado().existe, true);
    assert.equal(guardador.estado().error, null);
  });

  it("hidden sin nada pendiente no escribe", () => {
    const { guardador, escrituras } = entorno([]);
    guardador.guardar(datos(2));
    guardador.reescribirSiPendiente();
    assert.equal(escrituras.length, 1);
  });

  it("borrar vacía el estado y descarta lo pendiente", () => {
    const { guardador, escrituras, borrados } = entorno([{ ok: false, motivo: "sin-almacenamiento" }]);
    guardador.guardar(datos(2));
    guardador.borrar();
    guardador.reescribirSiPendiente();
    assert.equal(escrituras.length, 0);
    assert.equal(borrados(), 1);
    assert.equal(guardador.estado().existe, false);
    assert.equal(guardador.estado().numeroTurno, null);
  });
});
