import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  adelantarRelojTurno,
  arrancarRelojTurno,
  configurarRelojTurno,
  inyectarRelojDeTiempo,
  obtenerRelojTurno,
  pararRelojTurno,
  pausarRelojTurno,
  reanudarRelojTurno,
  registrarAlAgotarseReloj,
  reiniciarRelojTurno,
  tickRelojTurno,
  type SegundosReloj,
} from "@/juego/control/relojTurnoStore";

let t = 0;
let agotados = 0;
beforeEach(() => {
  t = 1000;
  agotados = 0;
  inyectarRelojDeTiempo(() => t);
  reiniciarRelojTurno();
  registrarAlAgotarseReloj(() => {
    agotados++;
  });
});

type Evento = { tipo: "arrancar" } | { tipo: "pausar" } | { tipo: "reanudar" } | { tipo: "tick"; ms: number } | { tipo: "parar" };
const eventos = fc.array(
  fc.oneof(
    fc.constant<Evento>({ tipo: "arrancar" }),
    fc.constant<Evento>({ tipo: "pausar" }),
    fc.constant<Evento>({ tipo: "reanudar" }),
    fc.constant<Evento>({ tipo: "parar" }),
    fc.integer({ min: 0, max: 20000 }).map<Evento>((ms) => ({ tipo: "tick", ms })),
  ),
  { maxLength: 60 },
);
const segundos = fc.constantFrom<SegundosReloj>(30, 45, 60);

function aplicar(e: Evento): void {
  if (e.tipo === "arrancar") arrancarRelojTurno();
  else if (e.tipo === "pausar") pausarRelojTurno();
  else if (e.tipo === "reanudar") reanudarRelojTurno();
  else if (e.tipo === "parar") pararRelojTurno();
  else {
    t += e.ms;
    tickRelojTurno();
  }
}

test("rel-9: 0 ≤ restanteMs ≤ configuradoS×1000 para cualquier secuencia", () => {
  fc.assert(
    fc.property(segundos, eventos, (s, secuencia) => {
      t = 1000;
      reiniciarRelojTurno();
      configurarRelojTurno(s);
      for (const e of secuencia) {
        aplicar(e);
        const { restanteMs } = obtenerRelojTurno();
        assert.ok(restanteMs >= 0 && restanteMs <= s * 1000, `restante ${restanteMs}`);
      }
    }),
  );
});

test("rel-9: el tiempo en pausa nunca descuenta (restante = total − tiempo en 'corriendo', acotado a 0)", () => {
  fc.assert(
    fc.property(
      segundos,
      fc.array(fc.tuple(fc.integer({ min: 0, max: 15000 }), fc.integer({ min: 0, max: 15000 })), { maxLength: 20 }),
      (s, tramos) => {
        t = 1000;
        reiniciarRelojTurno();
        configurarRelojTurno(s);
        arrancarRelojTurno();
        let corrido = 0;
        for (const [corriendo, pausado] of tramos) {
          if (obtenerRelojTurno().estado !== "corriendo") break;
          t += corriendo;
          corrido += corriendo;
          pausarRelojTurno();
          if (obtenerRelojTurno().estado !== "pausado") break;
          t += pausado;
          reanudarRelojTurno();
        }
        tickRelojTurno();
        assert.equal(obtenerRelojTurno().restanteMs, Math.max(0, s * 1000 - corrido));
      },
    ),
  );
});

test("rel-9: con Off ninguna secuencia llega a 'agotado'", () => {
  fc.assert(
    fc.property(eventos, (secuencia) => {
      t = 1000;
      reiniciarRelojTurno();
      configurarRelojTurno(null);
      agotados = 0;
      for (const e of secuencia) {
        aplicar(e);
        assert.notEqual(obtenerRelojTurno().estado, "agotado");
      }
      assert.equal(agotados, 0);
    }),
  );
});

test("rel-9: 'agotado' ocurre como mucho una vez por turno aunque sigan los ticks", () => {
  fc.assert(
    fc.property(segundos, fc.array(fc.integer({ min: 0, max: 90000 }), { minLength: 1, maxLength: 30 }), (s, saltos) => {
      t = 1000;
      reiniciarRelojTurno();
      registrarAlAgotarseReloj(() => {
        agotados++;
      });
      configurarRelojTurno(s);
      agotados = 0;
      arrancarRelojTurno();
      for (const ms of saltos) {
        t += ms;
        tickRelojTurno();
        pausarRelojTurno();
        reanudarRelojTurno();
      }
      const total = saltos.reduce((a, b) => a + b, 0);
      assert.equal(agotados, total >= s * 1000 ? 1 : 0);
    }),
  );
});

test("rel-3: adelantarRelojTurno descuenta por la misma ruta y agota; sin reloj corriendo no hace nada", () => {
  configurarRelojTurno(30);
  adelantarRelojTurno(5000);
  assert.equal(obtenerRelojTurno().restanteMs, 30000);
  arrancarRelojTurno();
  adelantarRelojTurno(5000);
  assert.equal(obtenerRelojTurno().restanteMs, 25000);
  adelantarRelojTurno(30000);
  assert.equal(obtenerRelojTurno().estado, "agotado");
  assert.equal(agotados, 1);
});
