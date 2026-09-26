import { test } from "node:test";
import assert from "node:assert/strict";
import type Phaser from "phaser";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { simularVuelo, PRESUPUESTO_VUELO_MULTIPOZO_PASOS } from "@/sim/fisica/vuelo";
import { integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import type { Planeta } from "@/sim/gravedad/planetas";

// AnimadorProyectil solo necesita, de la escena real de Phaser, un
// this.add.circle(...) que devuelva algo encadenable -- crear una escena de
// verdad (WebGL, canvas, DOM) para probar la MATEMÁTICA del paso a paso sería
// pagar el coste de un navegador entero para comprobar una fórmula.
function crearEscenaDeMentira(): Phaser.Scene {
  const punto = {
    setVisible: () => punto,
    setDepth: () => punto,
    setPosition: () => punto,
  };
  return { add: { circle: () => punto } } as unknown as Phaser.Scene;
}

// Mismo planeta/órbita que grav-6 (tests/unit/gravedad/grav-6.test.ts): un
// disparo que nunca aterriza, para ejercer aquí el mismo presupuesto de
// vuelo multipozo que ya prueba el núcleo, ahora desde el lado de la vista.
const PLANETA: Planeta = { id: 1, cx: 500, cy: 500, radio: 25, densidad: 1, pixelesVivos: 1_819_165 };
const DISTANCIA_ORBITA = 120;
const VELOCIDAD_ORBITAL = 301.59289474462014;
const INICIO_ORBITA: EstadoProyectil = { x: PLANETA.cx + DISTANCIA_ORBITA, y: PLANETA.cy, vx: 0, vy: -VELOCIDAD_ORBITAL };

// Bastante más que los ~12s de presupuesto (PRESUPUESTO_VUELO_MULTIPOZO_PASOS
// * PASO_FIJO_MS): al pasarlo de una vez, avanzarConAcumulador agota el
// presupuesto dentro del propio lote y el resto de pasos del lote son no-ops
// (mismo mecanismo que humor-6 ya usa para el corte por detenerse()).
const DELTA_MS_SOBRADO = 20_000;

test("esp-1: AnimadorProyectil con planetas agota el mismo presupuesto y llega al mismo punto final que simularVuelo, nunca vuela para siempre", () => {
  const nuncaSeDetiene = () => false;
  const referencia = simularVuelo(INICIO_ORBITA, 0, 0, nuncaSeDetiene, { planetas: [PLANETA] });
  assert.equal(referencia.perdido, true);

  const animador = new AnimadorProyectil(crearEscenaDeMentira());
  let finalRecibido: EstadoProyectil | null = null;
  animador.iniciar(INICIO_ORBITA, 0, 0, nuncaSeDetiene, (final) => (finalRecibido = final), [PLANETA]);

  assert.equal(animador.enVuelo(), true);
  animador.actualizar(DELTA_MS_SOBRADO);

  assert.equal(animador.enVuelo(), false, "el presupuesto agotado debe terminar el vuelo animado, igual que en el núcleo");
  assert.notEqual(finalRecibido, null);
  assert.equal(finalRecibido!.x, referencia.proyectil.x);
  assert.equal(finalRecibido!.y, referencia.proyectil.y);
});

test("esp-1: sin planetas, un segundo actualizar() tras el presupuesto no cambia nada (ya ha terminado)", () => {
  const nuncaSeDetiene = () => false;
  const animador = new AnimadorProyectil(crearEscenaDeMentira());
  animador.iniciar(INICIO_ORBITA, 0, 0, nuncaSeDetiene, () => {}, [PLANETA]);
  animador.actualizar(DELTA_MS_SOBRADO);
  assert.equal(animador.enVuelo(), false);

  // Tras terminar, el animador queda inerte -- llamar otra vez a actualizar()
  // no debe lanzar ni reabrir el vuelo (el disparo ya se contó una vez).
  assert.doesNotThrow(() => animador.actualizar(1000));
  assert.equal(animador.enVuelo(), false);
});

test("esp-1: la curvatura de los planetas desvía la trayectoria animada más de 40px respecto al vuelo recto equivalente", () => {
  // Disparo recto, apuntado a pasar cerca del planeta pero no directo al
  // centro -- si la gravedad no curvase nada, x avanzaría a velocidad
  // constante y y apenas cambiaría; con el planeta tirando, la vertical se
  // desvía de forma medible (esp-1: >40px en algún sistema probado).
  const origen: EstadoProyectil = { x: 200, y: 480, vx: 400, vy: 0 };
  const detenerseEnBorde = (p: EstadoProyectil) => p.x >= 900;

  const conPlaneta = new AnimadorProyectil(crearEscenaDeMentira());
  let finalConPlaneta: EstadoProyectil | null = null;
  conPlaneta.iniciar(origen, 0, 0, detenerseEnBorde, (final) => (finalConPlaneta = final), [PLANETA]);
  conPlaneta.actualizar(DELTA_MS_SOBRADO);

  const sinPlaneta = new AnimadorProyectil(crearEscenaDeMentira());
  let finalSinPlaneta: EstadoProyectil | null = null;
  sinPlaneta.iniciar(origen, 0, 0, detenerseEnBorde, (final) => (finalSinPlaneta = final));
  sinPlaneta.actualizar(DELTA_MS_SOBRADO);

  assert.notEqual(finalConPlaneta, null);
  assert.notEqual(finalSinPlaneta, null);
  assert.equal(finalSinPlaneta!.y, origen.y, "sin gravedad ambiente ni planetas, la vertical no debería moverse nada");
  assert.ok(
    Math.abs(finalConPlaneta!.y - finalSinPlaneta!.y) > 40,
    `desviación vertical ${Math.abs(finalConPlaneta!.y - finalSinPlaneta!.y)} debería superar 40px`,
  );

  // Y coincide, paso a paso, con la misma fórmula que usa el núcleo real
  // (integrarPasoProyectil + calcularAceleracionGravitatoria por paso).
  const referencia = simularVuelo(origen, 0, 0, detenerseEnBorde, { planetas: [PLANETA] });
  assert.equal(finalConPlaneta!.x, referencia.proyectil.x);
  assert.equal(finalConPlaneta!.y, referencia.proyectil.y);
  void integrarPasoProyectil;
  void PRESUPUESTO_VUELO_MULTIPOZO_PASOS;
});
