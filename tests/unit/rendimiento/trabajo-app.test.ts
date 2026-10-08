import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { calcularBaseMaquetacion, calcularRenderLienzo, calcularTrabajoApp, type FotogramaLoaf, type Intervalo } from "@/juego/rendimiento/trabajoApp";

const tiempo = fc.integer({ min: 400, max: 5000 });

const intervalo = fc.tuple(tiempo, fc.integer({ min: 0, max: 600 })).map(([inicio, d]): Intervalo => ({ inicio, fin: inicio + d }));

const fotograma = fc
  .tuple(tiempo, fc.integer({ min: 50, max: 800 }), fc.array(fc.tuple(fc.integer({ min: 0, max: 800 }), fc.integer({ min: 0, max: 400 })), { maxLength: 4 }), fc.integer({ min: 0, max: 800 }))
  .map(([inicio, d, scripts, estilo]): FotogramaLoaf => ({
    inicio,
    fin: inicio + d,
    scripts: scripts.map(([desde, dur]) => ({ inicio: inicio + desde, duracion: dur })),
    inicioEstiloMaquetacion: inicio + Math.max(1, d - estilo),
  }));

const ventana = intervalo.filter((v) => v.fin - v.inicio >= 1);

// Invariante 3 de respuesta-200ms.
test("res-1 (inv. 3): trabajoApp está entre 0 y la duración de la ventana", () => {
  fc.assert(
    fc.property(ventana, fc.array(fotograma, { maxLength: 8 }), fc.array(intervalo, { maxLength: 8 }), fc.integer({ min: 0, max: 500 }), (v, fotogramas, renders, base) => {
      const t = calcularTrabajoApp(v, fotogramas, renders, base);
      assert.ok(t >= 0 && t <= v.fin - v.inicio);
    }),
  );
});

test("res-1 (inv. 3): un script solapado por otro se cuenta una sola vez", () => {
  const f: FotogramaLoaf = { inicio: 0, fin: 100, scripts: [{ inicio: 10, duracion: 50 }, { inicio: 30, duracion: 50 }], inicioEstiloMaquetacion: 0 };
  assert.equal(calcularTrabajoApp({ inicio: 0, fin: 1000 }, [f], [], 0), 70);
});

test("res-1: el render de Phaser dentro de un script no cuenta como trabajo de la app", () => {
  const f: FotogramaLoaf = { inicio: 0, fin: 300, scripts: [{ inicio: 0, duracion: 300 }], inicioEstiloMaquetacion: 0 };
  const render = [{ inicio: 50, fin: 280 }];
  assert.equal(calcularTrabajoApp({ inicio: 0, fin: 400 }, [f], render, 0), 70);
  assert.equal(calcularRenderLienzo({ inicio: 0, fin: 400 }, render), 230);
});

// Invariante 4 de respuesta-200ms: el coste fijo del pintado no se cuela.
test("res-1 (inv. 4): sumar c al tramo de estilo de todos los fotogramas no cambia trabajoApp", () => {
  fc.assert(
    fc.property(ventana, fc.array(fotograma, { maxLength: 8 }), fc.array(fotograma, { maxLength: 8 }), fc.array(intervalo, { maxLength: 6 }), fc.integer({ min: 0, max: 300 }), (v, enVentana, reposo, renders, c) => {
      // Los fotogramas en reposo no tocan la ventana: la base solo sale de ellos.
      const sinVentana = reposo.filter((f) => !(f.inicio < v.fin && v.inicio < f.fin));
      // Sin ningún fotograma en reposo la base es 0 por definición y no hay nada que restar.
      fc.pre(sinVentana.length > 0);
      const sube = (f: FotogramaLoaf): FotogramaLoaf => ({ ...f, inicioEstiloMaquetacion: f.inicioEstiloMaquetacion - c });
      const todos = [...enVentana, ...sinVentana];
      const base0 = calcularBaseMaquetacion(todos, [v]);
      // Con el inicio del tramo desplazado, el tramo crece c en TODOS los fotogramas con tramo > 0.
      const todosC = todos.map((f) => (f.inicioEstiloMaquetacion > 0 ? sube(f) : f));
      const baseC = calcularBaseMaquetacion(todosC, [v]);
      const a = calcularTrabajoApp(v, todos, renders, base0);
      const b = calcularTrabajoApp(v, todosC, renders, baseC);
      assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
    }),
  );
});

test("res-1: sin fotogramas en reposo la base es 0", () => {
  assert.equal(calcularBaseMaquetacion([], [{ inicio: 0, fin: 10 }]), 0);
});
