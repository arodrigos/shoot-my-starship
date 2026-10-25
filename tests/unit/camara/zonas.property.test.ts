import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  ControladorCamara,
  DURACION_VER_TODO_MS,
  ZOOM_MAXIMO,
  encuadreAuto,
  encuadreCompleto,
  encuadreValido,
  limitarEncuadre,
  rectanguloLibre,
  transformarEncuadre,
  zoomMinimo,
  type CamaraFisica,
  type Dimensiones,
  type ObjetivoEncuadre,
  type Rect,
} from "@/juego/camara/controladorCamara";

const DIM: Dimensiones = { ancho: 1000, alto: 600 };
const RUNS = { numRuns: 300 };

function camaraFalsa(): CamaraFisica {
  return { setZoom: () => undefined, setScroll: () => undefined };
}

// Zonas pegadas a un borde, como las del HUD: una franja inferior, una esquina
// superior izquierda y un botón arriba a la derecha. Se garantiza que el libre
// pase del 25 % en los dos ejes.
const zona: fc.Arbitrary<Rect> = fc.oneof(
  fc.record({ alto: fc.integer({ min: 10, max: 220 }) }).map((z) => ({ x: 100, y: DIM.alto - z.alto, ancho: 600, alto: z.alto })),
  fc.record({ ancho: fc.integer({ min: 10, max: 200 }), alto: fc.integer({ min: 10, max: 200 }) }).map((z) => ({ x: 0, y: 0, ancho: z.ancho, alto: z.alto })),
  fc.constant({ x: DIM.ancho - 60, y: 0, ancho: 60, alto: 60 }),
);
const zonas = fc.array(zona, { maxLength: 5 });

const objetivo: fc.Arbitrary<ObjetivoEncuadre> = fc
  .record({
    tipo: fc.constantFrom("nave" as const, "proyectil" as const, "impacto" as const),
    x: fc.integer({ min: 0, max: DIM.ancho - 100 }),
    y: fc.integer({ min: 0, max: DIM.alto - 100 }),
    ancho: fc.integer({ min: 20, max: 100 }),
    alto: fc.integer({ min: 20, max: 100 }),
  })
  .map((o) => ({ ...o, ancho: Math.min(o.ancho, DIM.ancho - o.x), alto: Math.min(o.alto, DIM.alto - o.y) }));
const objetivos = fc.array(objetivo, { minLength: 1, maxLength: 4 });

function libreSuficiente(z: readonly Rect[]): boolean {
  const l = rectanguloLibre(DIM, z);
  return l.ancho >= DIM.ancho * 0.25 && l.alto >= DIM.alto * 0.25;
}

function solapan(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.ancho - 1e-6 && b.x < a.x + a.ancho - 1e-6 && a.y < b.y + b.alto - 1e-6 && b.y < a.y + a.alto - 1e-6;
}

test("invariante: encuadreAuto siempre devuelve un encuadre válido (sin objetivo bajo una zona ni fuera del lienzo)", () => {
  fc.assert(
    fc.property(zonas, objetivos, (z, o) => {
      fc.pre(libreSuficiente(z));
      // Un objetivo mayor que el libre no cabe en ninguna cámara.
      const libre = rectanguloLibre(DIM, z);
      fc.pre(o.every((x) => x.ancho <= libre.ancho * zoomMinimo(DIM, libre) && x.alto <= libre.alto * zoomMinimo(DIM, libre)));
      assert.ok(encuadreValido(encuadreAuto(DIM, z, o), DIM, z, o));
    }),
    RUNS,
  );
});

test("invariante: si la vista completa es válida, encuadreAuto devuelve exactamente la vista completa", () => {
  fc.assert(
    fc.property(zonas, objetivos, (z, o) => {
      fc.pre(encuadreValido(encuadreCompleto(DIM), DIM, z, o));
      assert.deepEqual(encuadreAuto(DIM, z, o), encuadreCompleto(DIM));
    }),
    RUNS,
  );
});

test("invariante: el zoom del auto está en [zoomMinimo, 1] y el de cualquier gesto en [zoomMinimo, 3]", () => {
  fc.assert(
    fc.property(
      zonas,
      objetivos,
      fc.double({ min: 0.1, max: 8, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      (z, o, factor, fx, fy) => {
        fc.pre(libreSuficiente(z));
        const libre = rectanguloLibre(DIM, z);
        const minimo = zoomMinimo(DIM, libre);
        const auto = encuadreAuto(DIM, z, o);
        assert.ok(auto.zoom >= minimo - 1e-9 && auto.zoom <= 1 + 1e-9);
        const g = transformarEncuadre(auto, DIM, { fx, fy }, { fx, fy }, factor, libre);
        assert.ok(g.zoom >= minimo - 1e-9 && g.zoom <= ZOOM_MAXIMO + 1e-9);
      },
    ),
    RUNS,
  );
});

test("invariante: rectanguloLibre no pisa ninguna zona, cabe en el lienzo y ningún candidato de los bordes tiene más área", () => {
  fc.assert(
    fc.property(zonas, (z) => {
      const l = rectanguloLibre(DIM, z);
      assert.ok(l.x >= 0 && l.y >= 0 && l.x + l.ancho <= DIM.ancho + 1e-9 && l.y + l.alto <= DIM.alto + 1e-9);
      assert.ok(!z.some((r) => solapan(l, r)));
      const xs = [0, DIM.ancho, ...z.flatMap((r) => [r.x, r.x + r.ancho])].sort((a, b) => a - b);
      const ys = [0, DIM.alto, ...z.flatMap((r) => [r.y, r.y + r.alto])].sort((a, b) => a - b);
      for (let i = 0; i < xs.length; i++)
        for (let j = i + 1; j < xs.length; j++)
          for (let k = 0; k < ys.length; k++)
            for (let m = k + 1; m < ys.length; m++) {
              const c = { x: xs[i], y: ys[k], ancho: xs[j] - xs[i], alto: ys[m] - ys[k] };
              if (!z.some((r) => solapan(c, r))) assert.ok(c.ancho * c.alto <= l.ancho * l.alto + 1e-6);
            }
    }),
    RUNS,
  );
});

function proyeccionDentroDelMundo(e: { zoom: number; cx: number; cy: number }, libre: Rect): void {
  const izq = e.cx + (libre.x - DIM.ancho / 2) / e.zoom;
  const arriba = e.cy + (libre.y - DIM.alto / 2) / e.zoom;
  const ancho = libre.ancho / e.zoom;
  const alto = libre.alto / e.zoom;
  if (ancho < DIM.ancho - 1e-6) assert.ok(izq >= -1e-6 && izq + ancho <= DIM.ancho + 1e-6, "eje x");
  if (alto < DIM.alto - 1e-6) assert.ok(arriba >= -1e-6 && arriba + alto <= DIM.alto + 1e-6, "eje y");
}

test("invariante: la proyección del libre no sale del mundo en el eje donde cabe, tras encuadreAuto, transformarEncuadre y limitarEncuadre", () => {
  fc.assert(
    fc.property(
      zonas,
      objetivos,
      fc.record({ zoom: fc.double({ min: 0.2, max: 5, noNaN: true }), cx: fc.double({ min: -500, max: 1500, noNaN: true }), cy: fc.double({ min: -500, max: 1500, noNaN: true }) }),
      fc.double({ min: 0.3, max: 4, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      (z, o, e, factor, f) => {
        fc.pre(libreSuficiente(z));
        const libre = rectanguloLibre(DIM, z);
        proyeccionDentroDelMundo(encuadreAuto(DIM, z, o), libre);
        proyeccionDentroDelMundo(limitarEncuadre(e, DIM, libre), libre);
        proyeccionDentroDelMundo(transformarEncuadre(e, DIM, { fx: f, fy: f }, { fx: 1 - f, fy: f }, factor, libre), libre);
      },
    ),
    RUNS,
  );
});

test("invariante: reevaluar es idempotente y quitar zonas a un encuadre válido no lo mueve", () => {
  fc.assert(
    fc.property(zonas, objetivos, (z, o) => {
      fc.pre(libreSuficiente(z));
      const ctl = new ControladorCamara(DIM, camaraFalsa(), () => true);
      ctl.fijarObjetivos(o);
      ctl.fijarZonas(z, "turno");
      const antes = ctl.instantanea().encuadre;
      const reencuadres = ctl.depuracion().reencuadres;
      ctl.fijarZonas(z, "apartado");
      ctl.fijarZonas(z, "apartado");
      assert.deepEqual(ctl.instantanea().encuadre, antes);
      assert.equal(ctl.depuracion().reencuadres, reencuadres);
      // Se aparta la consola: las zonas visibles se reducen y todo sigue válido.
      ctl.fijarZonas(z.slice(1), "apartado", z);
      assert.deepEqual(ctl.instantanea().encuadre, antes);
    }),
    RUNS,
  );
});

test("invariante: en manual, ningún cambio de zonas ni de objetivos cambia el encuadre; Ver todo vuelve al automático", () => {
  fc.assert(
    fc.property(zonas, zonas, objetivos, (z1, z2, o) => {
      const ctl = new ControladorCamara(DIM, camaraFalsa(), () => false);
      ctl.fijarZonas(z1, "turno");
      ctl.transformar({ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 0.5 }, 2);
      assert.equal(ctl.estado().modo, "manual");
      const antes = ctl.instantanea().encuadre;
      ctl.fijarObjetivos(o);
      ctl.fijarZonas(z2, "usuario");
      ctl.fijarZonas(z2, "apartado");
      assert.deepEqual(ctl.instantanea().encuadre, antes);
      ctl.verTodo();
      ctl.avanzar(DURACION_VER_TODO_MS);
      assert.equal(ctl.estado().modo, "auto");
    }),
    RUNS,
  );
});

test("ejemplo: una nave bajo la consola se encuadra en el libre y la vista completa vuelve al plegar", () => {
  const consola: Rect = { x: 0, y: 360, ancho: 1000, alto: 240 };
  const nave: ObjetivoEncuadre = { tipo: "nave", x: 700, y: 500, ancho: 80, alto: 80 };
  const e = encuadreAuto(DIM, [consola], [nave]);
  assert.notDeepEqual(e, encuadreCompleto(DIM));
  assert.ok(encuadreValido(e, DIM, [consola], [nave]));
  assert.deepEqual(encuadreAuto(DIM, [{ ...consola, y: 540, alto: 60 }], [{ ...nave, y: 300 }]), encuadreCompleto(DIM));
});
