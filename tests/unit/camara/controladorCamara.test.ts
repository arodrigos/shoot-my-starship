import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  ControladorCamara,
  DURACION_VER_TODO_MS,
  ZOOM_MAXIMO,
  ZOOM_VISTA_COMPLETA,
  seguirProyectil,
  vistaDe,
  type CamaraFisica,
  type Dimensiones,
} from "@/juego/camara/controladorCamara";

const DIM: Dimensiones = { ancho: 1000, alto: 600 };

function camaraFalsa(): CamaraFisica & { zoom: number; sx: number; sy: number } {
  const c = {
    zoom: 1,
    sx: 0,
    sy: 0,
    setZoom(z: number) {
      c.zoom = z;
    },
    setScroll(x: number, y: number) {
      c.sx = x;
      c.sy = y;
    },
  };
  return c;
}

const fraccion = fc.record({ fx: fc.double({ min: 0, max: 1, noNaN: true }), fy: fc.double({ min: 0, max: 1, noNaN: true }) });
const paso: fc.Arbitrary<Paso> = fc.oneof(
  fc.record({ tipo: fc.constant("gesto" as const), previo: fraccion, nuevo: fraccion, factor: fc.double({ min: 0.2, max: 5, noNaN: true }) }),
  fc.record({ tipo: fc.constant("rueda" as const), f: fraccion, factor: fc.double({ min: 0.5, max: 2, noNaN: true }) }),
);

type Paso =
  | { tipo: "gesto"; previo: { fx: number; fy: number }; nuevo: { fx: number; fy: number }; factor: number }
  | { tipo: "rueda"; f: { fx: number; fy: number }; factor: number };

function aplicar(ctl: ControladorCamara, pasos: readonly Paso[]): void {
  for (const p of pasos) {
    if (p.tipo === "gesto") ctl.transformar(p.previo, p.nuevo, p.factor);
    else ctl.transformar(p.f, p.f, p.factor);
  }
}

test("invariante: con cualquier secuencia de gestos y ruedas, el zoom está entre la vista completa y 3× y lo visible cabe en el mundo", () => {
  fc.assert(
    fc.property(fc.array(paso, { maxLength: 40 }), (pasos) => {
      const ctl = new ControladorCamara(DIM, camaraFalsa(), () => false);
      aplicar(ctl, pasos);
      const e = ctl.estado();
      assert.ok(e.zoom >= ZOOM_VISTA_COMPLETA - 1e-9 && e.zoom <= ZOOM_MAXIMO + 1e-9);
      assert.ok(e.x >= -1e-6 && e.y >= -1e-6);
      assert.ok(e.x + e.ancho <= DIM.ancho + 1e-6 && e.y + e.alto <= DIM.alto + 1e-6);
    }),
  );
});

test("invariante: tras verTodo() o alCambiarTurno() el encuadre es la vista completa (±1 u) y el modo, auto", () => {
  fc.assert(
    fc.property(fc.array(paso, { maxLength: 20 }), fc.boolean(), fc.boolean(), (pasos, animada, reducido) => {
      const camara = camaraFalsa();
      const ctl = new ControladorCamara(DIM, camara, () => reducido);
      aplicar(ctl, pasos);
      if (animada) {
        ctl.verTodo();
        ctl.avanzar(DURACION_VER_TODO_MS);
      } else ctl.alCambiarTurno();
      const e = ctl.estado();
      assert.ok(Math.abs(e.x) <= 1 && Math.abs(e.y) <= 1);
      assert.ok(Math.abs(e.ancho - DIM.ancho) <= 1 && Math.abs(e.alto - DIM.alto) <= 1);
      assert.equal(e.modo, "auto");
      assert.equal(camara.zoom, 1);
      assert.equal(ctl.manual, false);
    }),
  );
});

test("invariante: el punto del mundo bajo el dedo sigue bajo el dedo tras un zoom anclado", () => {
  fc.assert(
    fc.property(fc.array(paso, { maxLength: 10 }), fraccion, fc.double({ min: 1, max: 2, noNaN: true }), (pasos, f, factor) => {
      const ctl = new ControladorCamara(DIM, camaraFalsa(), () => false);
      aplicar(ctl, pasos);
      const antes = ctl.estado();
      const mundoX = antes.x + f.fx * antes.ancho;
      const mundoY = antes.y + f.fy * antes.alto;
      ctl.transformar(f, f, factor);
      const despues = ctl.estado();
      // El borde del mundo puede obligar a mover el punto: solo se exige cuando no hubo recorte.
      const sinRecorte = despues.x > 1e-6 && despues.y > 1e-6 && despues.x + despues.ancho < DIM.ancho - 1e-6 && despues.y + despues.alto < DIM.alto - 1e-6;
      if (sinRecorte && despues.zoom > antes.zoom && despues.zoom < ZOOM_MAXIMO) {
        assert.ok(Math.abs(despues.x + f.fx * despues.ancho - mundoX) < 1e-6);
        assert.ok(Math.abs(despues.y + f.fy * despues.alto - mundoY) < 1e-6);
      }
    }),
  );
});

test("pellizcar hacia dentro desde la vista completa no baja de la vista completa, y no se pasa de 3×", () => {
  const ctl = new ControladorCamara(DIM, camaraFalsa(), () => false);
  ctl.transformar({ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 0.5 }, 0.3);
  assert.equal(ctl.estado().zoom, 1);
  assert.equal(ctl.estado().modo, "auto");
  ctl.transformar({ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 0.5 }, 10);
  assert.equal(ctl.estado().zoom, ZOOM_MAXIMO);
  assert.equal(ctl.estado().modo, "manual");
});

test("pellizco que dobla la distancia: zoom 2× y el punto medio no se mueve", () => {
  const ctl = new ControladorCamara(DIM, camaraFalsa(), () => false);
  const medio = { fx: 0.4, fy: 0.3 };
  ctl.transformar(medio, medio, 2);
  const e = ctl.estado();
  assert.ok(Math.abs(e.zoom - 2) < 1e-9);
  assert.ok(Math.abs(e.x + medio.fx * e.ancho - 0.4 * DIM.ancho) < 1e-6);
});

test("«Ver todo» tarda 300 ms, el botón se oculta al empezar y con movimiento reducido es instantáneo", () => {
  const ctl = new ControladorCamara(DIM, camaraFalsa(), () => false);
  ctl.transformar({ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 0.5 }, 2);
  assert.equal(ctl.manual, true);
  ctl.verTodo();
  assert.equal(ctl.manual, false);
  ctl.avanzar(150);
  assert.ok(ctl.estado().zoom > 1 && ctl.estado().zoom < 2);
  ctl.avanzar(150);
  assert.equal(ctl.estado().zoom, 1);
  assert.equal(ctl.estado().modo, "auto");

  const reducido = new ControladorCamara(DIM, camaraFalsa(), () => true);
  reducido.transformar({ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 0.5 }, 2);
  reducido.verTodo();
  assert.equal(reducido.estado().zoom, 1);
});

test("el seguimiento no cambia el zoom y deja el proyectil dentro del encuadre", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 1.2, max: 3, noNaN: true }),
      fc.array(fc.record({ x: fc.double({ min: 0, max: 1000, noNaN: true }), y: fc.double({ min: 0, max: 600, noNaN: true }), dt: fc.double({ min: 1, max: 300, noNaN: true }) }), { minLength: 1, maxLength: 30 }),
      (zoom, ruta) => {
        const camara = camaraFalsa();
        const ctl = new ControladorCamara(DIM, camara, () => false);
        ctl.transformar({ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 0.5 }, zoom);
        const zoomInicial = ctl.estado().zoom;
        for (const p of ruta) {
          ctl.seguir({ x: p.x, y: p.y }, p.dt);
          const v = ctl.estado();
          assert.equal(v.zoom, zoomInicial);
          assert.ok(p.x >= v.x - 1e-6 && p.x <= v.x + v.ancho + 1e-6, "x dentro");
          assert.ok(p.y >= v.y - 1e-6 && p.y <= v.y + v.alto + 1e-6, "y dentro");
        }
      },
    ),
  );
});

test("seguirProyectil hace lerp hacia el proyectil cuando está dentro del recuadro", () => {
  const e = seguirProyectil({ zoom: 2, cx: 400, cy: 300 }, DIM, { x: 450, y: 300 }, 1000 / 60);
  assert.ok(Math.abs(e.cx - 405) < 1e-6);
  assert.deepEqual(vistaDe({ zoom: 2, cx: 500, cy: 300 }, DIM), { x: 250, y: 150, ancho: 500, alto: 300 });
});

test("el encuadre externo del remate no se limita ni lo pisa el seguimiento, y restaurar devuelve lo anterior", () => {
  const camara = camaraFalsa();
  const ctl = new ControladorCamara(DIM, camara, () => false);
  ctl.transformar({ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 0.5 }, 2);
  const snap = ctl.instantanea();
  ctl.fijarExterno({ zoom: 4, cx: 100, cy: 100 });
  ctl.seguir({ x: 900, y: 500 }, 16);
  assert.equal(camara.zoom, 4);
  ctl.restaurar(snap);
  assert.equal(camara.zoom, 2);
  assert.equal(ctl.estado().modo, "manual");
});
