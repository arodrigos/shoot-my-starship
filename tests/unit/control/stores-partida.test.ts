import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  limpiarParteDeGuerra,
  obtenerParteDeGuerra,
  publicarParteDeGuerra,
  solicitarOtraPartida,
  suscribirOtraPartida,
  suscribirParteDeGuerra,
} from "@/juego/control/parteDeGuerraStore";
import {
  obtenerParticipantes,
  publicarGanador,
  publicarParticipantes,
  publicarRivalesIA,
  reiniciarParticipantes,
  suscribirParticipantes,
} from "@/juego/control/participantesStore";
import { obtenerIntegridad, publicarIntegridad, reiniciarIntegridad, suscribirIntegridad } from "@/juego/control/integridadStore";
import {
  cerrarAyudaCamara,
  obtenerCamaraHud,
  pedirVerTodo,
  publicarCamaraManual,
  registrarManejadorVerTodo,
  reiniciarCamaraHud,
  suscribirCamaraHud,
} from "@/juego/control/camaraStore";
import {
  obtenerResultadoTurno,
  publicarResultadoTurno,
  reiniciarResultadoTurno,
  suscribirResultadoTurno,
} from "@/juego/control/resultadoTurnoStore";
import { limpiarCuentaAtras, obtenerCuentaAtras, publicarCuentaAtras, suscribirCuentaAtras } from "@/juego/control/cuentaAtrasStore";
import {
  AVISO_SIN_GUARDADO_MS,
  avisoSinGuardadoVisible,
  mostrarAvisoSinGuardado,
  reiniciarAvisoSinGuardado,
  suscribirAvisoSinGuardado,
} from "@/juego/control/avisoSinGuardadoStore";
import { INTEGRIDAD_MAXIMA } from "@/sim/naves/vida";
import type { EstadisticasPartida } from "@/sim/partida/parteDeGuerra";

const ESTADISTICAS: EstadisticasPartida = { disparos: 3, fallos: 1, autoimpactos: 0, danioHechoAlEnemigo: 90, pixelesDestruidos: 400 };

function contarAvisos(suscribir: (fn: () => void) => () => void): { avisos: () => number; baja: () => void } {
  let n = 0;
  const baja = suscribir(() => n++);
  return { avisos: () => n, baja };
}

describe("parteDeGuerraStore", () => {
  it("publica el parte con sus estadísticas y tarjetas vacías por defecto", () => {
    const { avisos, baja } = contarAvisos(suscribirParteDeGuerra);
    publicarParteDeGuerra({ medalla: "Oro", texto: "t" }, ESTADISTICAS);
    assert.deepEqual(obtenerParteDeGuerra(), { parte: { medalla: "Oro", texto: "t", estadisticas: ESTADISTICAS }, tarjetas: [] });
    assert.equal(avisos(), 1);
    limpiarParteDeGuerra();
    assert.deepEqual(obtenerParteDeGuerra(), { parte: null, tarjetas: [] });
    assert.equal(avisos(), 2);
    baja();
  });

  it("«otra partida» limpia el parte antes de avisar a quien la escucha", () => {
    publicarParteDeGuerra({ medalla: "Oro", texto: "t" }, ESTADISTICAS);
    const vistoAlAvisar: unknown[] = [];
    const baja = suscribirOtraPartida(() => vistoAlAvisar.push(obtenerParteDeGuerra().parte));
    solicitarOtraPartida();
    assert.deepEqual(vistoAlAvisar, [null]);
    baja();
    solicitarOtraPartida();
    assert.equal(vistoAlAvisar.length, 1);
  });
});

describe("participantesStore", () => {
  afterEach(() => reiniciarParticipantes());

  it("estado inicial: partida de siempre, un humano", () => {
    assert.deepEqual(obtenerParticipantes(), { rivalesIA: [], participantes: null, ganador: null, ganadorEsHumano: false, humanos: 1 });
  });

  it("publicar participantes cuenta humanos y borra un ganador anterior", () => {
    publicarGanador("Ana", true);
    publicarParticipantes([
      { nombre: "Ana", esHumano: true },
      { nombre: "Luis", esHumano: true },
      { nombre: "Chispa", esHumano: false },
    ]);
    const estado = obtenerParticipantes();
    assert.equal(estado.humanos, 2);
    assert.equal(estado.ganador, null);
    assert.equal(estado.ganadorEsHumano, false);
  });

  it("sin lista de participantes vuelve a contar un humano", () => {
    publicarParticipantes([{ nombre: "Chispa", esHumano: false }]);
    assert.equal(obtenerParticipantes().humanos, 0);
    publicarParticipantes(null);
    assert.equal(obtenerParticipantes().humanos, 1);
  });

  it("ganador: por defecto no humano; rivales IA se guardan tal cual", () => {
    const { avisos, baja } = contarAvisos(suscribirParticipantes);
    publicarGanador("Chispa");
    assert.equal(obtenerParticipantes().ganadorEsHumano, false);
    const rivales = [null, { nombreCorto: "Chispa", nivel: "facil", etiquetaNivel: "Fácil" }] as const;
    publicarRivalesIA(rivales);
    assert.equal(obtenerParticipantes().rivalesIA, rivales);
    assert.equal(avisos(), 2);
    baja();
  });
});

describe("integridadStore", () => {
  afterEach(() => reiniciarIntegridad());

  it("arranca con dos naves a integridad máxima", () => {
    assert.deepEqual(obtenerIntegridad().naves, [
      { id: 0, integridad: INTEGRIDAD_MAXIMA },
      { id: 1, integridad: INTEGRIDAD_MAXIMA },
    ]);
  });

  it("el id sale del índice, con cualquier número de naves", () => {
    const { avisos, baja } = contarAvisos(suscribirIntegridad);
    publicarIntegridad([{ integridad: 10 }, { integridad: 0 }, { integridad: 75 }]);
    assert.deepEqual(obtenerIntegridad().naves, [
      { id: 0, integridad: 10 },
      { id: 1, integridad: 0 },
      { id: 2, integridad: 75 },
    ]);
    assert.equal(avisos(), 1);
    baja();
  });
});

describe("camaraStore", () => {
  afterEach(() => reiniciarCamaraHud());

  it("solo avisa cuando algo cambia de verdad", () => {
    const { avisos, baja } = contarAvisos(suscribirCamaraHud);
    publicarCamaraManual(false);
    assert.equal(avisos(), 0);
    publicarCamaraManual(true);
    publicarCamaraManual(true);
    assert.equal(avisos(), 1);
    cerrarAyudaCamara();
    cerrarAyudaCamara();
    assert.equal(avisos(), 2);
    assert.deepEqual(obtenerCamaraHud(), { manual: true, ayudaVisible: false });
    reiniciarCamaraHud();
    assert.deepEqual(obtenerCamaraHud(), { manual: false, ayudaVisible: true });
    assert.equal(avisos(), 3);
    baja();
  });

  it("«Ver todo» llega solo al manejador vigente", () => {
    let viejo = 0;
    let nuevo = 0;
    assert.doesNotThrow(() => pedirVerTodo());
    const quitarViejo = registrarManejadorVerTodo(() => viejo++);
    const quitarNuevo = registrarManejadorVerTodo(() => nuevo++);
    quitarViejo();
    pedirVerTodo();
    quitarNuevo();
    pedirVerTodo();
    assert.deepEqual([viejo, nuevo], [0, 1]);
  });
});

describe("resultadoTurnoStore", () => {
  it("el texto nunca está vacío y reiniciar vuelve al inicial", () => {
    const inicial = obtenerResultadoTurno().texto;
    assert.ok(inicial.length > 0);
    const { avisos, baja } = contarAvisos(suscribirResultadoTurno);
    publicarResultadoTurno("Le has dado");
    assert.equal(obtenerResultadoTurno().texto, "Le has dado");
    reiniciarResultadoTurno();
    assert.equal(obtenerResultadoTurno().texto, inicial);
    assert.equal(avisos(), 2);
    baja();
  });
});

describe("cuentaAtrasStore", () => {
  it("no avisa si el segundo no cambia ni al limpiar lo ya limpio", () => {
    limpiarCuentaAtras();
    const { avisos, baja } = contarAvisos(suscribirCuentaAtras);
    limpiarCuentaAtras();
    assert.equal(avisos(), 0);
    publicarCuentaAtras(3);
    publicarCuentaAtras(3);
    assert.equal(avisos(), 1);
    publicarCuentaAtras(2);
    assert.equal(obtenerCuentaAtras().segundos, 2);
    limpiarCuentaAtras();
    assert.equal(obtenerCuentaAtras().segundos, null);
    assert.equal(avisos(), 3);
    baja();
  });
});

describe("avisoSinGuardadoStore", () => {
  afterEach(() => {
    reiniciarAvisoSinGuardado();
    mock.timers.reset();
  });

  it("se muestra y se oculta solo pasado el plazo", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    const { avisos, baja } = contarAvisos(suscribirAvisoSinGuardado);
    mostrarAvisoSinGuardado();
    assert.equal(avisoSinGuardadoVisible(), true);
    mock.timers.tick(AVISO_SIN_GUARDADO_MS - 1);
    assert.equal(avisoSinGuardadoVisible(), true);
    mock.timers.tick(1);
    assert.equal(avisoSinGuardadoVisible(), false);
    assert.equal(avisos(), 2);
    baja();
  });

  it("mostrarlo otra vez reinicia el plazo", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    mostrarAvisoSinGuardado();
    mock.timers.tick(AVISO_SIN_GUARDADO_MS - 100);
    mostrarAvisoSinGuardado();
    mock.timers.tick(200);
    assert.equal(avisoSinGuardadoVisible(), true);
    mock.timers.tick(AVISO_SIN_GUARDADO_MS);
    assert.equal(avisoSinGuardadoVisible(), false);
  });

  it("reiniciar lo oculta y anula el temporizador pendiente", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    mostrarAvisoSinGuardado();
    reiniciarAvisoSinGuardado();
    assert.equal(avisoSinGuardadoVisible(), false);
    const { avisos, baja } = contarAvisos(suscribirAvisoSinGuardado);
    mock.timers.tick(AVISO_SIN_GUARDADO_MS);
    assert.equal(avisos(), 0);
    baja();
  });
});
