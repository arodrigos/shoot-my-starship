import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio, siguienteAleatorio } from "@/sim/aleatorio";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { asentarNaves, buscarPosicionValida, PASO_ANILLO_U } from "@/sim/naves/asentamiento";
import { colocarNaves } from "@/sim/naves/colocacion";
import { esPosicionValida, limitesNave } from "@/sim/naves/zonaValida";
import { avanzar } from "@/sim/partida/avanzar";
import type { EstadoNave, EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { crearMascaraVacia, PLANETA_MIN } from "@/sim/terreno/mascara";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../../utils/sistemaGenerado";

const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
const LIMITES = limitesNave(MUNDO);

function mundoConPlaneta() {
  const mascara = crearMascaraVacia(MUNDO.ancho, MUNDO.alto);
  for (let y = 0; y < MUNDO.alto; y++) {
    for (let x = 0; x < MUNDO.ancho; x++) {
      if (Math.hypot(x - 1000, y - 400) <= 150) mascara.datos[y * mascara.ancho + x] = PLANETA_MIN;
    }
  }
  return mascara;
}

const nave = (x: number, y: number, integridad = 150): EstadoNave => ({ x, y, integridad });

test("inc-1: una nave metida en el planeta termina apoyada fuera, con la posición válida", () => {
  const mascara = mundoConPlaneta();
  const r = asentarNaves([nave(1000, 400), nave(300, 300)], MUNDO, mascara);
  assert.equal(r.asentadas.length, 1);
  assert.equal(r.asentadas[0].nave, 0);
  const movida = r.naves[0];
  assert.ok(esPosicionValida({ x: movida.x, y: movida.y as number }, MUNDO, mascara, [{ x: 300, y: 300 }]));
  assert.deepEqual(r.naves[1], nave(300, 300), "la que estaba bien no se toca");
});

test("inc-1: dos naves solapadas se separan y las dos quedan válidas", () => {
  const mascara = crearMascaraVacia(MUNDO.ancho, MUNDO.alto);
  const r = asentarNaves([nave(600, 500), nave(610, 500)], MUNDO, mascara);
  const [a, b] = r.naves;
  assert.ok(esPosicionValida({ x: a.x, y: a.y as number }, MUNDO, mascara, [{ x: b.x, y: b.y as number }]));
});

test("inc-1: sin sitio en todo el mundo la nave se destruye, nunca queda dentro", () => {
  const mascara = crearMascaraVacia(MUNDO.ancho, MUNDO.alto);
  mascara.datos.fill(PLANETA_MIN);
  const r = asentarNaves([nave(900, 500), nave(300, 300, 0)], MUNDO, mascara);
  assert.deepEqual(r.destruidas, [0]);
  assert.equal(r.naves[0].integridad, 0);
});

test("inc-1: las naves muertas no se asientan", () => {
  const r = asentarNaves([nave(1000, 400, 0)], MUNDO, mundoConPlaneta());
  assert.equal(r.asentadas.length, 0);
});

// Invariante 1 sobre el asentamiento: cualquier colocación, válida o no, acaba válida.
test("inc-1 (invariante 1): para cualquier posición, las naves vivas terminan válidas", () => {
  const mascara = mundoConPlaneta();
  const punto = fc.record({ x: fc.double({ min: LIMITES.xMin, max: LIMITES.xMax, noNaN: true }), y: fc.double({ min: LIMITES.yMin, max: LIMITES.yMax, noNaN: true }) });
  fc.assert(
    fc.property(fc.array(punto, { minLength: 1, maxLength: 3 }), (puntos) => {
      const r = asentarNaves(puntos.map((p) => nave(p.x, p.y)), MUNDO, mascara);
      r.naves.forEach((n, id) => {
        if (n.integridad <= 0) return;
        const otras = r.naves.flatMap((o, j) => (j !== id && o.integridad > 0 ? [{ x: o.x, y: o.y as number }] : []));
        assert.ok(esPosicionValida({ x: n.x, y: n.y as number }, MUNDO, mascara, otras));
      });
    }),
    { numRuns: 40 },
  );
});

// Invariante 2 (y inc-2): un estado ya válido no se toca, ni siquiera la referencia.
test("inc-2 (invariante 2): lo que ya es válido no se mueve y asentar es idempotente", () => {
  const mascara = mundoConPlaneta();
  const punto = fc.record({ x: fc.double({ min: LIMITES.xMin, max: LIMITES.xMax, noNaN: true }), y: fc.double({ min: LIMITES.yMin, max: LIMITES.yMax, noNaN: true }) });
  fc.assert(
    fc.property(fc.array(punto, { minLength: 1, maxLength: 3 }), (puntos) => {
      const primero = asentarNaves(puntos.map((p) => nave(p.x, p.y)), MUNDO, mascara);
      const segundo = asentarNaves(primero.naves, MUNDO, mascara);
      assert.equal(segundo.naves, primero.naves);
      assert.equal(segundo.asentadas.length, 0);
    }),
    { numRuns: 40 },
  );
});

// Invariante 3: no hay un destino válido claramente más cerca del elegido.
test("inc-1 (invariante 3): la distancia recorrida es la mínima de la búsqueda por anillos (± 2 u)", () => {
  const mascara = mundoConPlaneta();
  fc.assert(
    fc.property(fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), fc.double({ min: 0, max: 140, noNaN: true }), (angulo, dentro) => {
      const desde = { x: 1000 + dentro * Math.cos(angulo), y: 400 + dentro * Math.sin(angulo) };
      const destino = buscarPosicionValida(desde, MUNDO, mascara, []);
      assert.ok(destino !== null);
      const recorrido = Math.hypot(destino.x - desde.x, destino.y - desde.y);
      for (let r = PASO_ANILLO_U; r < recorrido - PASO_ANILLO_U; r += PASO_ANILLO_U) {
        for (let grados = 0; grados < 360; grados += 15) {
          const p = { x: desde.x + r * Math.cos((grados * Math.PI) / 180), y: desde.y + r * Math.sin((grados * Math.PI) / 180) };
          // un punto válido a 15° de paso y más cerca que el elegido contradiría la mínima
          if (esPosicionValida(p, MUNDO, mascara, [])) assert.ok(r >= recorrido - 2 * PASO_ANILLO_U, `válido a ${r} u, elegido ${recorrido} u`);
        }
      }
    }),
    { numRuns: 15 },
  );
});

// Reproducción del fallo de Adrián sobre el simulador real: partidas de 3 naves
// con armas y disparos al azar. Antes del arreglo la semilla 1 dejaba una nave
// inválida ya en el primer turno (rayo-laser) y seguía así los siguientes.
test("inc-1: partidas reales con armas al azar nunca dejan una nave viva en posición inválida", () => {
  const tiradas: Array<{ semilla: number; turnos: number }> = [{ semilla: 1, turnos: 5 }, { semilla: 2, turnos: 4 }, { semilla: 3, turnos: 4 }];
  for (const { semilla, turnos } of tiradas) {
    const col = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), 3, [false, false, false]);
    let e: EstadoPartida = { version: 1, mundo: MUNDO, mascara: col.sistema.mascara, naves: col.naves, ordenTurno: [0, 1, 2], turno: 0, numeroTurno: 0, aleatorio: col.aleatorio, resultado: { tipo: "en-curso" }, planetas: col.sistema.planetas };
    let ale = crearEstadoAleatorio(semilla * 7 + 1);
    const sorteo = (): number => {
      const paso = siguienteAleatorio(ale);
      ale = paso.estado;
      return paso.valor;
    };
    for (let t = 0; t < turnos && e.resultado.tipo === "en-curso"; t++) {
      const a = sorteo();
      const potencia = sorteo() * 100;
      const angulo = sorteo() * 180;
      const arma = CATALOGO_ARMAS[Math.floor(sorteo() * CATALOGO_ARMAS.length)];
      const vivos = e.naves.flatMap((n, i) => (n.integridad > 0 && i !== e.turno ? [i] : []));
      e = avanzar(e, { arma: arma.id, anguloGrados: angulo, potencia, objetivoId: vivos[Math.floor(a * vivos.length)] }).estado;
      e.naves.forEach((n, i) => {
        if (n.integridad <= 0 || n.y === undefined) return;
        const otras = e.naves.flatMap((o, j) => (j !== i && o.integridad > 0 && o.y !== undefined ? [{ x: o.x, y: o.y }] : []));
        assert.ok(esPosicionValida({ x: n.x, y: n.y }, MUNDO, e.mascara, otras), `semilla ${semilla} turno ${t} (${arma.id}) nave ${i}`);
      });
    }
  }
});
