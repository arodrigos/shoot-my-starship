import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  SEMILLA_MEDICION,
  cancelarMedicion,
  fijarCopiaMedicion,
  fijarTramoMedicion,
  guardarResolutorCopia,
  inpAlIniciarMedicion,
  iniciarPartidaMedicion,
  medicionCancelada,
  obtenerMedicion,
  rechazarCopia,
  registrarImpactoMedicion,
  reiniciarMedicion,
  resolverCopia,
  suscribirMedicion,
  terminarMedicion,
} from "@/juego/control/medicionStore";

const global = globalThis as unknown as { navigator?: unknown };
const NAVEGADOR_ORIGINAL = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function fijarNavegador(valor: unknown): void {
  Object.defineProperty(globalThis, "navigator", { value: valor, configurable: true, writable: true });
}

const esperar = () => new Promise((resolver) => setImmediate(resolver));

describe("medicionStore", () => {
  afterEach(() => {
    mock.timers.reset();
    reiniciarMedicion();
    if (NAVEGADOR_ORIGINAL) Object.defineProperty(globalThis, "navigator", NAVEGADOR_ORIGINAL);
    else delete global.navigator;
  });

  it("la semilla es fija", () => {
    assert.equal(SEMILLA_MEDICION, 20261025);
  });

  it("iniciar guarda el INP de partida y no se reinicia con una medición en curso", () => {
    iniciarPartidaMedicion(120, "no-soportada");
    assert.equal(inpAlIniciarMedicion(), 120);
    assert.equal(obtenerMedicion().estado, "en-curso");
    assert.equal(obtenerMedicion().copia, "no-soportada");
    fijarTramoMedicion(2, "pepinazo");
    iniciarPartidaMedicion(999);
    assert.equal(inpAlIniciarMedicion(), 120);
    assert.deepEqual(obtenerMedicion().tramo, { indice: 2, total: 5, nombre: "pepinazo" });
  });

  it("terminar quita el tramo; los impactos se acumulan por nombre", () => {
    iniciarPartidaMedicion();
    fijarTramoMedicion(1, "reposo");
    registrarImpactoMedicion("pepinazo", { x: 1, y: 2 });
    registrarImpactoMedicion("racimo", { x: 3, y: 4 });
    registrarImpactoMedicion("pepinazo", { x: 5, y: 6 });
    terminarMedicion({ estado: "terminada", texto: "informe", valida: true });
    const m = obtenerMedicion();
    assert.equal(m.tramo, null);
    assert.equal(m.estado, "terminada");
    assert.equal(m.texto, "informe");
    assert.equal(m.valida, true);
    assert.deepEqual(m.impactos, { pepinazo: { x: 5, y: 6 }, racimo: { x: 3, y: 4 } });
  });

  it("cancelar se anota y una medición nueva lo borra", () => {
    iniciarPartidaMedicion();
    assert.equal(medicionCancelada(), false);
    cancelarMedicion();
    assert.equal(medicionCancelada(), true);
    terminarMedicion({ estado: "cancelada", texto: null, valida: null });
    iniciarPartidaMedicion();
    assert.equal(medicionCancelada(), false);
  });

  it("reiniciar vuelve a inactiva, sin INP, sin cancelación y avisa", () => {
    iniciarPartidaMedicion(50);
    cancelarMedicion();
    let avisos = 0;
    const baja = suscribirMedicion(() => avisos++);
    reiniciarMedicion();
    assert.equal(obtenerMedicion().estado, "inactiva");
    assert.equal(inpAlIniciarMedicion(), null);
    assert.equal(medicionCancelada(), false);
    assert.equal(avisos, 1);
    baja();
  });

  it("rechazarCopia llega al rechazo guardado una sola vez", () => {
    const rechazos: unknown[] = [];
    guardarResolutorCopia(
      () => assert.fail("no debe resolver"),
      (e) => rechazos.push(e),
    );
    rechazarCopia("motivo");
    rechazarCopia("otra");
    assert.deepEqual(rechazos, ["motivo"]);
  });

  it("resolverCopia entrega el texto y, si la copia ya se confirmó, no reintenta", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    let escrituras = 0;
    fijarNavegador({ clipboard: { writeText: async () => void escrituras++ } });
    const textos: string[] = [];
    guardarResolutorCopia(
      (t) => textos.push(t),
      () => undefined,
    );
    resolverCopia("informe");
    resolverCopia("otra vez");
    assert.deepEqual(textos, ["informe"]);
    fijarCopiaMedicion("copiada");
    mock.timers.tick(2000);
    assert.equal(escrituras, 0);
    assert.equal(obtenerMedicion().copia, "copiada");
  });

  it("si la copia sigue pendiente a los 2 s, reintenta con writeText", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    const escritos: string[] = [];
    fijarNavegador({ clipboard: { writeText: async (t: string) => void escritos.push(t) } });
    resolverCopia("informe");
    mock.timers.tick(1999);
    assert.deepEqual(escritos, []);
    mock.timers.tick(1);
    await esperar();
    assert.deepEqual(escritos, ["informe"]);
    assert.equal(obtenerMedicion().copia, "copiada");
  });

  it("si el reintento falla, la copia queda «fallida»", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    fijarNavegador({
      clipboard: {
        writeText: async () => {
          throw new Error("sin foco");
        },
      },
    });
    resolverCopia("informe");
    mock.timers.tick(2000);
    await esperar();
    assert.equal(obtenerMedicion().copia, "fallida");
  });

  it("sin portapapeles, la copia queda «no-soportada»", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    fijarNavegador({});
    resolverCopia("informe");
    mock.timers.tick(2000);
    assert.equal(obtenerMedicion().copia, "no-soportada");
  });
});
