import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  cerrarAyudaApuntado,
  fijarApuntadoDirecto,
  obtenerEstadoControl,
  publicarJugable,
  publicarTurno,
  reiniciarControl,
} from "@/juego/control/store";
import { ANGULO_INICIAL_GRADOS, POTENCIA_INICIAL } from "@/juego/control/apuntado";
import type { IdNave } from "@/sim/partida/tipos";

// Invariante apu-3: para cualquier secuencia de turnos con 2+ humanos, el
// apuntado que ve un asiento al empezar su turno es el último que fijó ESE
// asiento (o 45°/50 en su primer turno), nunca el de otro.
test("apuntado-y-relevo: cada asiento recupera su propio apuntado tras cualquier secuencia de turnos", () => {
  const asiento = fc.constantFrom<IdNave>(0, 1, 2, 3);
  const accion = fc.record({
    asiento,
    angulo: fc.double({ min: 0, max: 359.9, noNaN: true }),
    potencia: fc.double({ min: 0, max: 100, noNaN: true }),
  });
  fc.assert(
    fc.property(fc.array(accion, { minLength: 1, maxLength: 30 }), (acciones) => {
      reiniciarControl();
      const ultimoPorAsiento = new Map<IdNave, { angulo: number; potencia: number }>();
      for (const { asiento: id, angulo, potencia } of acciones) {
        publicarTurno(id);
        const esperado = ultimoPorAsiento.get(id) ?? { angulo: ANGULO_INICIAL_GRADOS, potencia: POTENCIA_INICIAL };
        assert.equal(obtenerEstadoControl().ajuste.anguloGrados, esperado.angulo);
        assert.equal(obtenerEstadoControl().ajuste.potencia, esperado.potencia);
        fijarApuntadoDirecto(angulo, potencia);
        ultimoPorAsiento.set(id, { angulo: obtenerEstadoControl().ajuste.anguloGrados, potencia: obtenerEstadoControl().ajuste.potencia });
      }
    }),
    { numRuns: 200 },
  );
});

test("apuntado-y-relevo: la ayuda de apuntado sale una vez por asiento y no vuelve tras cerrarla", () => {
  reiniciarControl();
  publicarTurno(0);
  assert.equal(obtenerEstadoControl().ayudaApuntadoVisible, true);
  cerrarAyudaApuntado();
  publicarTurno(1);
  assert.equal(obtenerEstadoControl().ayudaApuntadoVisible, true, "el asiento 1 aún no la ha visto");
  publicarJugable(true);
  fijarApuntadoDirecto(10, 10);
  assert.equal(obtenerEstadoControl().ayudaApuntadoVisible, false, "apuntar la retira");
  publicarTurno(0);
  assert.equal(obtenerEstadoControl().ayudaApuntadoVisible, false, "el asiento 0 la cerró");
  publicarTurno(1);
  assert.equal(obtenerEstadoControl().ayudaApuntadoVisible, false, "el asiento 1 ya jugó con ella");
});
