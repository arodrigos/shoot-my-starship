import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { alcancePropulsores, volarConPropulsores } from "@/sim/equipo/propulsores";
import { esPosicionValida } from "@/sim/naves/zonaValida";
import { avanzar } from "@/sim/partida/avanzar";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { crearMascaraVacia } from "@/sim/terreno/mascara";

const MUNDO: ParametrosMundo = { ancho: 1046, alto: 1859, gravedad: 1, deriva: 0, etiquetaDeriva: "" };

function escenario(saldo: number | null): EstadoPartida {
  return {
    version: 1,
    mundo: MUNDO,
    mascara: crearMascaraVacia(MUNDO.ancho, MUNDO.alto),
    naves: [
      { x: 200, y: 600, integridad: 100 },
      { x: 900, y: 1200, integridad: 100 },
    ],
    ordenTurno: [0, 1],
    turno: 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(5),
    resultado: { tipo: "en-curso" },
    ...(saldo === null ? { modo: "barra-libre" as const } : { modo: "presupuesto" as const, saldos: [saldo, saldo] }),
  };
}

test("esc-2: el alcance es el radio del círculo de un cuarto de la pantalla (≈ 393 u en 1046x1859)", () => {
  assert.ok(Math.abs(alcancePropulsores(MUNDO) - 393) <= 5, `alcance ${alcancePropulsores(MUNDO)}`);
});

test("esc-2: a 0° con potencia 100 la nave llega al círculo y la ruta termina en él", () => {
  const estado = escenario(null);
  const vuelo = volarConPropulsores({ desde: estado.naves[0] as { x: number; y: number }, anguloGrados: 0, potencia: 100, mundo: MUNDO, mascara: estado.mascara, otras: [{ x: 900, y: 1200 }] });
  assert.equal(vuelo.motivo, "alcance");
  const distancia = Math.hypot(vuelo.destino.x - 200, vuelo.destino.y - 600);
  assert.ok(Math.abs(distancia - alcancePropulsores(MUNDO)) < 1, `distancia ${distancia}`);

  // La posición final de avanzar() coincide con el final de la previsualización.
  const tras = avanzar(estado, { accion: "propulsores", arma: "propulsores", anguloGrados: 0, potencia: 100, objetivoId: 1 }).estado;
  assert.ok(Math.abs(tras.naves[0].x - vuelo.destino.x) <= 2 && Math.abs((tras.naves[0].y ?? 0) - vuelo.destino.y) <= 2);
  assert.equal(tras.numeroTurno, 1);
  assert.equal(tras.turno, 1);
});

test("esc-2: en presupuesto con saldo 100 los propulsores dejan 40; en barra libre no cobran", () => {
  const orden = { accion: "propulsores" as const, arma: "propulsores", anguloGrados: 0, potencia: 100, objetivoId: 1 };
  assert.equal(avanzar(escenario(100), orden).estado.saldos?.[0], 40);
  assert.equal(avanzar(escenario(null), orden).estado.saldos, undefined);
  assert.throws(() => avanzar(escenario(50), orden), /cuesta 60 cr/);
});

test("esc-2 límite: hacia el borde se para en el margen, sin salirse", () => {
  const estado = escenario(null);
  const vuelo = volarConPropulsores({ desde: { x: 200, y: 600 }, anguloGrados: 180, potencia: 100, mundo: MUNDO, mascara: estado.mascara, otras: [] });
  assert.equal(vuelo.motivo, "obstaculo");
  assert.ok(vuelo.destino.x >= 66, `x ${vuelo.destino.x}`);
  assert.ok(esPosicionValida(vuelo.destino, MUNDO, estado.mascara, []));
});

test("esc-2 límite: contra otra nave se para antes de solaparla", () => {
  const estado = escenario(null);
  const vuelo = volarConPropulsores({ desde: { x: 200, y: 600 }, anguloGrados: 0, potencia: 100, mundo: { ...MUNDO, gravedad: 0 }, mascara: estado.mascara, otras: [{ x: 420, y: 600 }] });
  assert.equal(vuelo.motivo, "obstaculo");
  assert.ok(Math.hypot(vuelo.destino.x - 420, vuelo.destino.y - 600) >= 52);
});

// Invariante 1: para cualquier ángulo, potencia y gravedad, el destino está a
// ≤ alcance de la salida y es una posición válida.
test("esc-2 propiedad: el destino está a ≤ alcance y es siempre una posición válida", () => {
  const mascara = crearMascaraVacia(MUNDO.ancho, MUNDO.alto);
  fc.assert(
    fc.property(
      fc.integer({ min: 70, max: MUNDO.ancho - 70 }),
      fc.integer({ min: 70, max: 1500 }),
      fc.integer({ min: 0, max: 3599 }),
      fc.integer({ min: 0, max: 100 }),
      fc.constantFrom(0, 0.6, 1, 1.4),
      (x, y, decimas, potencia, gravedad) => {
        const mundo = { ...MUNDO, gravedad };
        const vuelo = volarConPropulsores({ desde: { x, y }, anguloGrados: decimas / 10, potencia, mundo, mascara, otras: [] });
        assert.ok(Math.hypot(vuelo.destino.x - x, vuelo.destino.y - y) <= alcancePropulsores(mundo) + 1e-6);
        assert.ok(esPosicionValida(vuelo.destino, mundo, mascara, []) || (vuelo.destino.x === x && vuelo.destino.y === y));
      },
    ),
    { numRuns: 150 },
  );
});
