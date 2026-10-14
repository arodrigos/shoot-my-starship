import test from "node:test";
import assert from "node:assert/strict";
import { conectarCiclo, type EntornoCiclo, type SerwistVentana } from "@/juego/pwa/ciclo";
import { despacharPwa, obtenerDatosPwa } from "@/juego/pwa/estadoPwa";

type Oyente = (evento: { isUpdate?: boolean }) => void;

function crearSw() {
  const oyentes = new Map<string, Oyente>();
  const sw = {
    addEventListener: (tipo: string, oyente: Oyente) => void oyentes.set(tipo, oyente),
    register: async () => undefined,
    update: async () => undefined,
    messageSkipWaiting: () => undefined,
  } as unknown as SerwistVentana;
  return { sw, emitir: (tipo: string, evento: { isUpdate?: boolean } = {}) => oyentes.get(tipo)?.(evento) };
}

test("pwa-9: persist se pide una vez tras la primera instalación y su rechazo no cambia el estado", async () => {
  let llamadas = 0;
  const entorno: EntornoCiclo = {
    enLinea: () => true,
    almacenamiento: { persist: async () => { llamadas++; throw new Error("denegado"); } },
    recargar: () => undefined,
  };
  const { sw, emitir } = crearSw();
  conectarCiclo(sw, entorno);
  emitir("installed", { isUpdate: false });
  await new Promise((resolver) => setImmediate(resolver));
  assert.equal(llamadas, 1);
  assert.equal(obtenerDatosPwa().estado, "listo-sin-conexion");
  emitir("installed", { isUpdate: true });
  assert.equal(llamadas, 1);
});

test("pwa-2: controlling no recarga si el usuario no pulsó Recargar", () => {
  let recargas = 0;
  const { sw, emitir } = crearSw();
  conectarCiclo(sw, { enLinea: () => true, almacenamiento: undefined, recargar: () => void recargas++ });
  emitir("waiting");
  emitir("controlling");
  assert.equal(recargas, 0);
});

test("pwa-2: con dos instancias escuchando, Recargar recarga exactamente una vez", () => {
  let recargas = 0;
  const entorno: EntornoCiclo = { enLinea: () => true, almacenamiento: undefined, recargar: () => void recargas++ };
  const a = crearSw();
  const b = crearSw();
  conectarCiclo(a.sw, entorno);
  conectarCiclo(b.sw, entorno);
  b.emitir("waiting");
  despacharPwa({ tipo: "recargar" });
  a.emitir("controlling");
  b.emitir("controlling");
  assert.equal(recargas, 1);
});
