import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma, CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { crearRobot, faseDeRobots, MAX_SALTOS_ROBOT, type EstadoRobot } from "@/sim/armas/minirobot";
import type { Planeta } from "@/sim/gravedad/planetas";
import { colocarNaves } from "@/sim/naves/colocacion";
import { octavoDelMundo } from "@/sim/naves/desplazamiento";
import { avanzar } from "@/sim/partida/avanzar";
import { deserializarEstado, serializarEstado } from "@/sim/partida/serializacion";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { crearMascaraVacia, esSolido, type Mascara } from "@/sim/terreno/mascara";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../utils/sistemaGenerado";

const ID_ARMA = "minirobot-saltaplanetas";
const DANIO_ROBOT = (() => {
  const efecto = buscarArma(ID_ARMA).efecto;
  assert.equal(efecto.tipo, "danio");
  return efecto.tipo === "danio" ? efecto.danioMaximo : 0;
})();

function pintarDisco(mascara: Mascara, planeta: Planeta): void {
  for (let y = Math.floor(planeta.cy - planeta.radio); y <= Math.ceil(planeta.cy + planeta.radio); y++) {
    for (let x = Math.floor(planeta.cx - planeta.radio); x <= Math.ceil(planeta.cx + planeta.radio); x++) {
      if (Math.hypot(x - planeta.cx, y - planeta.cy) <= planeta.radio) mascara.datos[y * mascara.ancho + x] = planeta.id;
    }
  }
}

// rob-1: el mundo exacto del criterio, tres planetas de radio 60 sobre la
// diagonal de A a B a 1100, 750 y 420 u de B.
function escenarioTresPlanetas(): EstadoPartida {
  const mundo: ParametrosMundo = { ancho: 1046, alto: 1859, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
  const mascara = crearMascaraVacia(mundo.ancho, mundo.alto);
  const b = { x: 850, y: 1600 };
  const ux = -650 / Math.hypot(650, 1300);
  const uy = -1300 / Math.hypot(650, 1300);
  const planetas: Planeta[] = [1100, 750, 420].map((d, i) => ({
    id: i + 1,
    cx: b.x + ux * d,
    cy: b.y + uy * d,
    radio: 60,
    densidad: 0.0001,
    pixelesVivos: 0,
  }));
  for (const planeta of planetas) pintarDisco(mascara, planeta);
  const conMasa = planetas.map((planeta) => ({ ...planeta, pixelesVivos: mascara.datos.filter((m) => m === planeta.id).length }));
  return {
    version: 1,
    mundo,
    mascara,
    naves: [
      { x: 200, y: 300, integridad: 100 },
      { x: b.x, y: b.y, integridad: 100 },
    ],
    ordenTurno: [0, 1],
    turno: 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(7),
    resultado: { tipo: "en-curso" },
    planetas: conMasa,
  };
}

// Barrido determinista de ángulo y potencia hasta que el robot se queda en el
// planeta pedido: no se fija un ángulo a mano porque la gravedad de los tres
// planetas curva la trayectoria.
const memoRobotEnPlaneta = new Map<number, EstadoPartida>();
function dispararRobotAlPlaneta(estado: EstadoPartida, planetaId: number): EstadoPartida {
  // El escenario es siempre el mismo y el barrido cuesta ~10 s: se hace una vez.
  const memo = memoRobotEnPlaneta.get(planetaId);
  if (memo) return memo;
  const resuelto = barrerHastaPlaneta(estado, planetaId);
  memoRobotEnPlaneta.set(planetaId, resuelto);
  return resuelto;
}

function barrerHastaPlaneta(estado: EstadoPartida, planetaId: number): EstadoPartida {
  for (let potencia = 100; potencia >= 20; potencia -= 5) {
    for (let angulo = 0; angulo < 360; angulo += 1) {
      const turno = avanzar(estado, { arma: ID_ARMA, anguloGrados: angulo, potencia, objetivoId: 1 });
      if (turno.estado.robots?.length === 1 && turno.estado.robots[0].planetaId === planetaId) return turno.estado;
    }
  }
  throw new Error(`ninguna combinación deja al robot en el planeta ${planetaId}`);
}

// Disparo inofensivo del rival y del dueño entre saltos: sale por el borde del
// mundo sin tocar nada.
function disparoAlVacio(estado: EstadoPartida): EstadoPartida {
  const objetivoId = estado.turno === 0 ? 1 : 0;
  const angulo = estado.turno === 0 ? 180 : 0;
  return avanzar(estado, { arma: "pepinazo-cortesia", anguloGrados: angulo, potencia: 100, objetivoId }).estado;
}

test("rob-1: el robot va de P1 a P2 a P3 y detona sobre el rival al 4.º turno de su dueño", () => {
  let estado = dispararRobotAlPlaneta(escenarioTresPlanetas(), 1);
  assert.equal(estado.turno, 1, "el disparo del robot gasta el turno de A como cualquier otro");
  const posicionesAlEmpezarA: (number | undefined)[] = [];
  for (let ronda = 0; ronda < 3; ronda++) {
    estado = disparoAlVacio(estado); // B dispara; al cerrar empieza el turno de A
    assert.equal(estado.turno, 0);
    posicionesAlEmpezarA.push(estado.robots?.[0]?.planetaId);
    assert.equal(estado.naves[0].integridad, 100, "A no sufre nada en estos turnos");
    if (ronda < 2) {
      assert.equal(estado.naves[1].integridad, 100, `ronda ${ronda}: B intacto mientras el robot salta`);
      estado = disparoAlVacio(estado); // A juega con normalidad con el robot en marcha
    }
  }
  assert.deepEqual(posicionesAlEmpezarA.slice(0, 2), [2, 3], "2.º turno de A en P2, 3.º en P3");
  assert.equal(estado.robots, undefined, "en el 4.º turno el robot ya ha detonado y desaparece");
  assert.equal(estado.naves[1].integridad, 100 - DANIO_ROBOT, "B pierde exactamente el daño declarado del robot");
});

test("rob-1: la detonación del robot sale en detonaciones y en el evento robot-detona", () => {
  let estado = dispararRobotAlPlaneta(escenarioTresPlanetas(), 1);
  estado = disparoAlVacio(estado);
  estado = disparoAlVacio(estado);
  estado = disparoAlVacio(estado);
  estado = disparoAlVacio(estado);
  const final = avanzar(estado, { arma: "pepinazo-cortesia", anguloGrados: 0, potencia: 100, objetivoId: 0 });
  assert.equal(final.detonaciones.some((d) => d.armaId === ID_ARMA && d.danioAplicado === DANIO_ROBOT && d.sobre === "nave"), true);
  assert.equal(final.eventos.some((e) => e.tipo === "robot-detona" && e.objetivo === 1 && e.danio === DANIO_ROBOT), true);
});

test("rob-1: el aterrizaje no detona ni hace daño, y el catálogo lo declara como comportamiento propio", () => {
  const inicial = escenarioTresPlanetas();
  const posado = avanzar(inicial, { arma: ID_ARMA, anguloGrados: 0, potencia: 100, objetivoId: 1 });
  const robotPosado = dispararRobotAlPlaneta(inicial, 1);
  assert.equal(robotPosado.robots?.[0].saltos, 0);
  assert.deepEqual(posado.estado.naves.map((n) => n.integridad), [100, 100]);
  assert.equal(CATALOGO_ARMAS.filter((arma) => arma.comportamiento.tipo === "minirobot").length, 1);
});

test("rob-1: si el objetivo muere el robot elige al rival vivo más cercano, y si muere el dueño se desactiva", () => {
  const base = escenarioTresPlanetas();
  const mundo = base.mundo;
  const robot: EstadoRobot = { dueno: 0, objetivoId: 1, armaId: ID_ARMA, planetaId: 1, x: 358, y: 556, saltos: 0 };
  const naves = [
    { x: 200, y: 300, integridad: 100 },
    { x: 850, y: 1600, integridad: 0 },
    { x: 480, y: 800, integridad: 100 },
  ];
  const fase = faseDeRobots({ robots: [robot], turno: 0, naves, mascara: base.mascara, mundo, planetas: base.planetas });
  assert.equal(fase.robots[0]?.objetivoId, 2, "pasa al rival vivo más cercano al robot");

  const sinDueno = faseDeRobots({ robots: [robot], turno: 0, naves: [{ ...naves[0], integridad: 0 }, naves[1], naves[2]], mascara: base.mascara, mundo, planetas: base.planetas });
  assert.equal(sinDueno.robots.length, 0);
  assert.equal(sinDueno.detonaciones.length, 0);
});

test("rob-3: la partida con un robot activo se serializa y se reproduce igual (misma semilla, mismas entradas)", () => {
  const partir = () => dispararRobotAlPlaneta(escenarioTresPlanetas(), 1);
  const a = partir();
  const b = partir();
  assert.equal(serializarEstado(a), serializarEstado(b));
  const ida = serializarEstado(a);
  assert.equal(serializarEstado(deserializarEstado(ida)), ida, "ida y vuelta por JSON sin pérdidas");
  assert.equal(serializarEstado(disparoAlVacio(a)), serializarEstado(disparoAlVacio(deserializarEstado(ida))));
});

const MUNDO_LOTE: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };

function estadoParaSemilla(semilla: number): EstadoPartida {
  const colocacion = colocarNaves(semilla, MUNDO_LOTE, crearEstadoAleatorio(semilla), 2, [false, false]);
  return {
    version: 1,
    mundo: MUNDO_LOTE,
    mascara: colocacion.sistema.mascara,
    naves: colocacion.naves,
    ordenTurno: [0, 1],
    turno: 0,
    numeroTurno: 0,
    aleatorio: colocacion.aleatorio,
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
  };
}

function hayRocaCerca(mascara: Mascara, x: number, y: number, radio: number): boolean {
  for (let dy = -radio; dy <= radio; dy++) {
    for (let dx = -radio; dx <= radio; dx++) {
      if (esSolido(mascara, Math.round(x) + dx, Math.round(y) + dy)) return true;
    }
  }
  return false;
}

// Invariantes de rob-1/rob-2 para cualquier sistema generado y cualquier punto
// de aterrizaje: distancia estrictamente decreciente en cada salto, como mucho
// 4 saltos y detonación a lo más en el 5.º turno, y reposo sobre la superficie.
test("invariantes del robot: distancia decreciente, ≤ 4 saltos, detona a lo sumo en el 5.º turno y reposo sobre la superficie", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 4000 }), fc.nat({ max: 5 }), fc.double({ min: 0, max: Math.PI * 2, noNaN: true }), (semilla, indicePlaneta, angulo) => {
      const estado = estadoParaSemilla(semilla);
      const planetas = estado.planetas ?? [];
      fc.pre(planetas.length > 0);
      const planeta = planetas[indicePlaneta % planetas.length];
      const robotInicial = crearRobot({
        dueno: 0,
        objetivoId: 1,
        armaId: ID_ARMA,
        contacto: { x: planeta.cx + Math.cos(angulo) * planeta.radio, y: planeta.cy + Math.sin(angulo) * planeta.radio },
        mascara: estado.mascara,
        planetas,
      });
      fc.pre(robotInicial !== undefined);
      let robot = robotInicial as EstadoRobot;
      assert.equal(esSolido(estado.mascara, Math.round(robot.x), Math.round(robot.y)), false, "el reposo no está dentro de roca");
      assert.equal(hayRocaCerca(estado.mascara, robot.x, robot.y, 2), true, "y está a ≤ 2 u de la roca");

      const objetivo = estado.naves[1];
      let turnosDuenoTrasDisparo = 0;
      let detonado = false;
      while (!detonado && turnosDuenoTrasDisparo < MAX_SALTOS_ROBOT + 1) {
        turnosDuenoTrasDisparo += 1;
        const distanciaAntes = Math.hypot(robot.x - objetivo.x, (robot.y) - (objetivo.y as number));
        const fase = faseDeRobots({ robots: [robot], turno: 0, naves: estado.naves, mascara: estado.mascara, mundo: estado.mundo, planetas });
        if (fase.detonaciones.length > 0) {
          detonado = true;
          assert.equal(fase.robots.length, 0);
          break;
        }
        robot = fase.robots[0];
        assert.ok(Math.hypot(robot.x - objetivo.x, robot.y - (objetivo.y as number)) < distanciaAntes, "cada salto acerca al casco");
        assert.ok(robot.saltos <= MAX_SALTOS_ROBOT);
        assert.equal(esSolido(estado.mascara, Math.round(robot.x), Math.round(robot.y)), false, "tras saltar tampoco está dentro de roca");
        assert.equal(hayRocaCerca(estado.mascara, robot.x, robot.y, 2), true);
      }
      assert.equal(detonado, true, "detona como mucho en el 5.º turno de su dueño");
      assert.ok(octavoDelMundo(estado.mundo) > 0);
    }),
    { numRuns: 120 },
  );
});
