import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cerrarRelevo,
  confirmarRelevo,
  obtenerRelevo,
  publicarRelevo,
  registrarManejadorRelevo,
  reiniciarRelevo,
  suscribirRelevo,
  type ResumenRelevo,
} from "@/juego/control/relevoStore";
import {
  limpiarReaccion,
  obtenerReaccion,
  publicarReaccion,
  registrarManejadorRepeticion,
  solicitarRepeticion,
  suscribirReaccion,
} from "@/juego/control/reaccion";

const RESUMEN: ResumenRelevo = { tirador: "Ana", arma: "Pepinazo", danio: 30, fallo: false, eliminadas: [] };

describe("relevoStore", () => {
  it("publicar abre el relevo y avisa; cerrar vuelve al estado inicial", () => {
    reiniciarRelevo();
    let avisos = 0;
    const baja = suscribirRelevo(() => avisos++);
    publicarRelevo("Luis", RESUMEN, "broma");
    assert.deepEqual(obtenerRelevo(), { activo: true, jugador: "Luis", resumen: RESUMEN, broma: "broma" });
    assert.equal(avisos, 1);
    cerrarRelevo();
    assert.deepEqual(obtenerRelevo(), { activo: false, jugador: null, resumen: null, broma: null });
    assert.equal(avisos, 2);
    baja();
  });

  it("cerrar un relevo ya cerrado no avisa a nadie", () => {
    reiniciarRelevo();
    let avisos = 0;
    const baja = suscribirRelevo(() => avisos++);
    cerrarRelevo();
    assert.equal(avisos, 0);
    baja();
  });

  it("darse de baja corta los avisos", () => {
    reiniciarRelevo();
    let avisos = 0;
    const baja = suscribirRelevo(() => avisos++);
    baja();
    publicarRelevo("Ana", null, null);
    assert.equal(avisos, 0);
  });

  it("confirmar solo llama al manejador con el relevo abierto", () => {
    reiniciarRelevo();
    let llamadas = 0;
    const quitar = registrarManejadorRelevo(() => llamadas++);
    confirmarRelevo();
    assert.equal(llamadas, 0);
    publicarRelevo("Ana", null, null);
    confirmarRelevo();
    assert.equal(llamadas, 1);
    quitar();
    confirmarRelevo();
    assert.equal(llamadas, 1);
  });

  it("quitar un manejador viejo no borra el que lo sustituyó", () => {
    reiniciarRelevo();
    let viejo = 0;
    let nuevo = 0;
    const quitarViejo = registrarManejadorRelevo(() => viejo++);
    const quitarNuevo = registrarManejadorRelevo(() => nuevo++);
    quitarViejo();
    publicarRelevo("Ana", null, null);
    confirmarRelevo();
    assert.deepEqual([viejo, nuevo], [0, 1]);
    quitarNuevo();
  });
});

describe("reaccion", () => {
  it("cada publicación cambia la clave aunque el texto se repita", () => {
    const clave0 = obtenerReaccion().clave;
    let avisos = 0;
    const baja = suscribirReaccion(() => avisos++);
    publicarReaccion("¡Ay!", "autoimpacto");
    publicarReaccion("¡Ay!", "autoimpacto");
    assert.deepEqual(obtenerReaccion(), { texto: "¡Ay!", tipoEvento: "autoimpacto", clave: clave0 + 2 });
    assert.equal(avisos, 2);
    baja();
  });

  it("limpiar borra texto y tipo pero conserva la clave", () => {
    publicarReaccion("x", "deriva-traiciona");
    const clave = obtenerReaccion().clave;
    limpiarReaccion();
    assert.deepEqual(obtenerReaccion(), { texto: null, tipoEvento: null, clave });
  });

  it("la repetición solo llega al manejador vigente", () => {
    let viejo = 0;
    let nuevo = 0;
    assert.doesNotThrow(() => solicitarRepeticion());
    const quitarViejo = registrarManejadorRepeticion(() => viejo++);
    solicitarRepeticion();
    const quitarNuevo = registrarManejadorRepeticion(() => nuevo++);
    quitarViejo();
    solicitarRepeticion();
    assert.deepEqual([viejo, nuevo], [1, 1]);
    quitarNuevo();
    solicitarRepeticion();
    assert.deepEqual([viejo, nuevo], [1, 1]);
  });
});
