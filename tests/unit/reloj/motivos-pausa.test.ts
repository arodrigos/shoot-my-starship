import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  arrancarRelojTurno,
  AVISO_TIEMPO_MINIMO_MS,
  AVISO_TIEMPO_TOPE_MS,
  cerrarAvisoTiempoAlAterrizar,
  configurarRelojTurno,
  inyectarRelojDeTiempo,
  mostrarAvisoTiempo,
  obtenerRelojTurno,
  pausarRelojTurno,
  reanudarRelojTurno,
  reiniciarRelojTurno,
  tickRelojTurno,
  type MotivoPausaReloj,
} from "@/juego/control/relojTurnoStore";

let t = 0;
const MOTIVOS: readonly MotivoPausaReloj[] = ["ajustes", "pestana-oculta"];

beforeEach(() => {
  t = 0;
  inyectarRelojDeTiempo(() => t);
  // Deja el conjunto de motivos vacío entre tests.
  for (const m of MOTIVOS) reanudarRelojTurno(m);
  reiniciarRelojTurno();
  configurarRelojTurno(30);
});

test("rel-2: ⚙ y pestaña oculta se componen; solo reanuda sin ningún motivo", () => {
  arrancarRelojTurno();
  t = 1000;
  pausarRelojTurno("ajustes");
  t = 2000;
  pausarRelojTurno("pestana-oculta");
  t = 3000;
  reanudarRelojTurno("ajustes");
  assert.equal(obtenerRelojTurno().estado, "pausado");
  assert.equal(obtenerRelojTurno().restanteMs, 29000);
  t = 10000;
  reanudarRelojTurno("pestana-oculta");
  assert.equal(obtenerRelojTurno().estado, "corriendo");
  t = 11000;
  tickRelojTurno();
  assert.equal(obtenerRelojTurno().restanteMs, 28000);
});

test("rel-2: reanudar un motivo no pausado no cambia nada; pausar dos veces y reanudar una reanuda", () => {
  arrancarRelojTurno();
  reanudarRelojTurno("ajustes");
  assert.equal(obtenerRelojTurno().estado, "corriendo");
  pausarRelojTurno("ajustes");
  pausarRelojTurno("ajustes");
  reanudarRelojTurno("ajustes");
  assert.equal(obtenerRelojTurno().estado, "corriendo");
});

test("rel-1: con ⚙ abierto al empezar el turno el reloj nace pausado con el valor entero", () => {
  pausarRelojTurno("ajustes");
  arrancarRelojTurno();
  assert.equal(obtenerRelojTurno().estado, "pausado");
  assert.equal(obtenerRelojTurno().restanteMs, 30000);
  t = 60000;
  tickRelojTurno();
  assert.equal(obtenerRelojTurno().estado, "pausado");
  reanudarRelojTurno("ajustes");
  t = 62000;
  tickRelojTurno();
  assert.equal(obtenerRelojTurno().restanteMs, 28000);
});

test("rel-2: corre si y solo si no queda ningún motivo (property)", () => {
  const operacion = fc.record({
    pausar: fc.boolean(),
    motivo: fc.constantFrom(...MOTIVOS),
    avance: fc.integer({ min: 0, max: 500 }),
  });
  fc.assert(
    fc.property(fc.array(operacion, { maxLength: 40 }), (ops) => {
      t = 0;
      reiniciarRelojTurno();
      configurarRelojTurno(30);
      for (const m of MOTIVOS) reanudarRelojTurno(m);
      arrancarRelojTurno();
      const activos = new Set<MotivoPausaReloj>();
      let previo = obtenerRelojTurno().restanteMs;
      for (const op of ops) {
        t += op.avance;
        if (op.pausar) {
          pausarRelojTurno(op.motivo);
          activos.add(op.motivo);
        } else {
          reanudarRelojTurno(op.motivo);
          activos.delete(op.motivo);
        }
        tickRelojTurno();
        const { estado, restanteMs } = obtenerRelojTurno();
        // En 30 s con avances de <20 s totales nunca se agota.
        assert.equal(estado, activos.size === 0 ? "corriendo" : "pausado");
        assert.ok(restanteMs <= previo && restanteMs >= 0);
        previo = restanteMs;
      }
      for (const m of MOTIVOS) reanudarRelojTurno(m);
    }),
  );
});

test("rel-4: el aviso dura al menos 3 s aunque aterrice antes, y se cierra al aterrizar después", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    mostrarAvisoTiempo();
    cerrarAvisoTiempoAlAterrizar();
    mock.timers.tick(AVISO_TIEMPO_MINIMO_MS - 100);
    assert.equal(obtenerRelojTurno().aviso, true);
    mock.timers.tick(100);
    assert.equal(obtenerRelojTurno().aviso, false);

    mostrarAvisoTiempo();
    mock.timers.tick(5000);
    assert.equal(obtenerRelojTurno().aviso, true);
    cerrarAvisoTiempoAlAterrizar();
    assert.equal(obtenerRelojTurno().aviso, false);
  } finally {
    mock.timers.reset();
  }
});

test("rel-4: sin aterrizaje el aviso se oculta al llegar al tope", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    mostrarAvisoTiempo();
    mock.timers.tick(AVISO_TIEMPO_TOPE_MS - 1);
    assert.equal(obtenerRelojTurno().aviso, true);
    mock.timers.tick(1);
    assert.equal(obtenerRelojTurno().aviso, false);
  } finally {
    mock.timers.reset();
  }
});

test("rel-4: un aterrizaje sin aviso visible no marca el aviso siguiente", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    cerrarAvisoTiempoAlAterrizar();
    mostrarAvisoTiempo();
    mock.timers.tick(AVISO_TIEMPO_MINIMO_MS + 100);
    assert.equal(obtenerRelojTurno().aviso, true);
  } finally {
    mock.timers.reset();
  }
});
