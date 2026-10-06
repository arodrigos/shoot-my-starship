import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { COSTE_ESCUDO } from "@/sim/equipo/catalogo";
import { avanzar } from "@/sim/partida/avanzar";
import type { EntradaDeTurno, EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { crearMascaraVacia } from "@/sim/terreno/mascara";

// Gravedad casi nula y sin planetas: un disparo recto es casi una línea, así que
// acertar es geometría y no una búsqueda de ángulo. No puede ser exactamente 0:
// sin planetas, un disparo que falla necesita caer para que el vuelo termine.
const MUNDO: ParametrosMundo = { ancho: 1046, alto: 1859, gravedad: 0.02, deriva: 0, etiquetaDeriva: "" };

function escenario(modo: "presupuesto" | "barra-libre", saldos: readonly number[] = [850, 850]): EstadoPartida {
  return {
    version: 1,
    mundo: MUNDO,
    mascara: crearMascaraVacia(MUNDO.ancho, MUNDO.alto),
    // A arriba, B abajo en la misma vertical: B apunta a 90° y da en A.
    naves: [
      { x: 520, y: 700, integridad: 100 },
      { x: 520, y: 1300, integridad: 100 },
    ],
    ordenTurno: [0, 1],
    turno: 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(11),
    resultado: { tipo: "en-curso" },
    modo,
    ...(modo === "presupuesto" ? { saldos } : {}),
  };
}

// El objetivo es siempre «el otro»: la entrada declara a quién se apunta y
// avanzar() la rechaza si coincide con el tirador.
function deTurno(estado: EstadoPartida, entrada: EntradaDeTurno): EntradaDeTurno {
  return { ...entrada, objetivoId: estado.turno === 0 ? 1 : 0 };
}

const ACTIVAR: EntradaDeTurno = { accion: "escudo", arma: "escudo", anguloGrados: 0, potencia: 0, objetivoId: 1 };
const PEPINAZO_A_A: EntradaDeTurno = { arma: "pepinazo-cortesia", anguloGrados: 90, potencia: 60, objetivoId: 0 };
const PETARDO_AL_VACIO: EntradaDeTurno = { arma: "petardo-de-feria", anguloGrados: 0, potencia: 40, objetivoId: 1 };

// esc-1 (núcleo): activar cuesta, gasta el turno, y protege exactamente dos
// disparos ajenos; el tercero hace daño.
test("esc-1: el escudo cobra 90, gasta el turno y para dos disparos ajenos", () => {
  let estado = escenario("presupuesto");
  estado = avanzar(estado, deTurno(estado, ACTIVAR)).estado;
  assert.equal(estado.saldos?.[0], 850 - COSTE_ESCUDO);
  assert.equal(estado.numeroTurno, 1);
  assert.equal(estado.naves[0].escudoTurnosRestantes, 2);

  estado = avanzar(estado, deTurno(estado, PEPINAZO_A_A)).estado; // B dispara
  assert.equal(estado.naves[0].integridad, 100, "primer disparo parado");
  assert.deepEqual({ x: estado.naves[0].x, y: estado.naves[0].y }, { x: 520, y: 700 }, "no se desplaza");
  assert.equal(estado.naves[0].escudoTurnosRestantes, 1, "baja al empezar el turno de A");

  estado = avanzar(estado, deTurno(estado, PETARDO_AL_VACIO)).estado; // A dispara al vacío
  estado = avanzar(estado, deTurno(estado, PEPINAZO_A_A)).estado; // B repite
  assert.equal(estado.naves[0].integridad, 100, "segundo disparo parado");
  assert.equal(estado.naves[0].escudoTurnosRestantes, 0, "al empezar el tercer turno de A ya no protege");

  estado = avanzar(estado, deTurno(estado, PETARDO_AL_VACIO)).estado;
  estado = avanzar(estado, deTurno(estado, PEPINAZO_A_A)).estado;
  assert.ok(estado.naves[0].integridad < 100, "el tercer disparo sí hace daño");
});

test("esc-1: no se puede reactivar mientras está activo ni activar sin saldo", () => {
  const activo = avanzar(escenario("presupuesto"), ACTIVAR).estado;
  const conSaldo = avanzar(activo, deTurno(activo, PETARDO_AL_VACIO)).estado; // turno de B pasa a A con escudo 1
  assert.throws(() => avanzar(conSaldo, deTurno(conSaldo, ACTIVAR)), /ya tiene el escudo activo/);

  const pobre = escenario("presupuesto", [50, 850]);
  const antes = JSON.stringify(pobre);
  assert.throws(() => avanzar(pobre, deTurno(pobre, ACTIVAR)), /cuesta 90 cr/);
  assert.equal(JSON.stringify(pobre), antes, "rechazado sin mutar el estado");
});

test("en barra libre el escudo no cuesta ni toca saldos", () => {
  const estado = avanzar(escenario("barra-libre"), ACTIVAR).estado;
  assert.equal(estado.saldos, undefined);
  assert.equal(estado.naves[0].escudoTurnosRestantes, 2);
});

// Invariante 2: el escudo no cubre el autodaño. La Despedida daña a quien la
// dispara con o sin escudo.
test("esc-1 límite: el autodaño de una Despedida con el escudo activo sí resta vida", () => {
  let estado = avanzar(escenario("barra-libre"), ACTIVAR).estado;
  estado = avanzar(estado, deTurno(estado, PETARDO_AL_VACIO)).estado; // B
  assert.ok((estado.naves[0].escudoTurnosRestantes ?? 0) > 0);
  const tras = avanzar(estado, deTurno(estado, { arma: "despedida", anguloGrados: 270, potencia: 30, objetivoId: 1 })).estado;
  assert.ok(tras.naves[0].integridad < 100, "el tirador paga su propia Despedida");
});

// Invariantes 3 y 4 (propiedad): para cualquier secuencia de turnos, el
// contador nunca es negativo, nunca sube salvo al activarlo, y cada turno
// consume exactamente una acción (numeroTurno +1).
test("esc-1 propiedad: el contador del escudo nunca es negativo ni sube sin activarlo", () => {
  const accion = fc.constantFrom<EntradaDeTurno>(ACTIVAR, PEPINAZO_A_A, PETARDO_AL_VACIO);
  fc.assert(
    fc.property(fc.array(accion, { minLength: 1, maxLength: 12 }), (secuencia) => {
      let estado = escenario("barra-libre");
      for (const candidata of secuencia) {
        if (estado.resultado.tipo === "terminada") break;
        const entrada = deTurno(estado, candidata);
        const antes = estado;
        const yaActivo = (antes.naves[antes.turno].escudoTurnosRestantes ?? 0) > 0;
        if (entrada.accion === "escudo" && yaActivo) continue;
        estado = avanzar(antes, entrada).estado;
        assert.equal(estado.numeroTurno, antes.numeroTurno + 1);
        estado.naves.forEach((nave, id) => {
          const antesN = antes.naves[id].escudoTurnosRestantes ?? 0;
          const ahora = nave.escudoTurnosRestantes ?? 0;
          assert.ok(ahora >= 0);
          const activadoAhora = entrada.accion === "escudo" && id === antes.turno;
          if (!activadoAhora) assert.ok(ahora <= antesN, "solo activar lo sube");
        });
      }
    }),
    { numRuns: 60 },
  );
});

// Invariante 2 (propiedad): con escudo, ningún disparo ajeno hace daño ni mueve.
test("esc-1 propiedad: con escudo activo no hay daño ni desplazamiento de disparos ajenos", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 359 }), fc.integer({ min: 10, max: 100 }), fc.constantFrom("pepinazo-cortesia", "petardo-de-feria", "racimo-de-tuppers"), (angulo, potencia, arma) => {
      const protegida = avanzar(escenario("barra-libre"), ACTIVAR).estado; // turno de B
      const tras = avanzar(protegida, { arma, anguloGrados: angulo, potencia, objetivoId: 0 }).estado;
      assert.equal(tras.naves[0].integridad, 100);
      assert.equal(tras.naves[0].x, 520);
      assert.equal(tras.naves[0].y, 700);
    }),
    { numRuns: 80 },
  );
});
