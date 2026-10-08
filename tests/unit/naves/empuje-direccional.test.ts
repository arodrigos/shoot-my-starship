import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import type { Planeta } from "@/sim/gravedad/planetas";
import {
  distanciaMinimaDesplazamiento,
  longitudDeEmpuje,
  octavoDelMundo,
  PASO_EMPUJE_U,
  recolocarTrasImpacto,
  recorrerEmpuje,
} from "@/sim/naves/desplazamiento";
import { esPosicionValida, limitesNave, type PuntoNave } from "@/sim/naves/zonaValida";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import { crearMascaraVacia, PLANETA_MIN, type Mascara } from "@/sim/terreno/mascara";

const MUNDO: ParametrosMundo = { ancho: 2000, alto: 1000, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
const OCTAVO = octavoDelMundo(MUNDO);
const LIMITES = limitesNave(MUNDO);
const TOLERANCIA_BORDE_U = 0.5;
const grados = (g: number): number => (g * Math.PI) / 180;

function mundoConPlaneta(): { mascara: Mascara; pozos: readonly Planeta[]; planeta: Planeta } {
  const mascara = crearMascaraVacia(MUNDO.ancho, MUNDO.alto);
  const planeta: Planeta = { id: PLANETA_MIN, cx: 1000, cy: 300, radio: 120, densidad: 1, pixelesVivos: 0 };
  let vivos = 0;
  for (let y = 0; y < MUNDO.alto; y++) {
    for (let x = 0; x < MUNDO.ancho; x++) {
      if (Math.hypot(x - planeta.cx, y - planeta.cy) <= planeta.radio) {
        mascara.datos[y * mascara.ancho + x] = PLANETA_MIN;
        vivos++;
      }
    }
  }
  const conMasa = { ...planeta, pixelesVivos: vivos };
  return { mascara, pozos: [conMasa], planeta: conMasa };
}

const VACIO = crearMascaraVacia(MUNDO.ancho, MUNDO.alto);
const LONGITUD_MAXIMA = OCTAVO;

function recorrer(desde: PuntoNave, direccion: PuntoNave, longitud = LONGITUD_MAXIMA, extra: { mascara?: Mascara; pozos?: readonly Planeta[]; otras?: PuntoNave[] } = {}) {
  return recorrerEmpuje({ desde, direccion, longitud, mundo: MUNDO, mascara: extra.mascara ?? VACIO, otras: extra.otras ?? [], ...(extra.pozos ? { pozos: extra.pozos } : {}) });
}

function longitudRecorrida(puntos: readonly PuntoNave[]): number {
  return puntos.slice(1).reduce((total, p, i) => total + Math.hypot(p.x - puntos[i].x, p.y - puntos[i].y), 0);
}

// emp-1 (invariante 1): lejos de bordes y pozos el desplazamiento sigue la
// velocidad del proyectil con ≤ 1° de error.
test("emp-1: sin bordes ni pozos, el desplazamiento va en la dirección del disparo (≤ 1°)", () => {
  fc.assert(
    fc.property(fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), fc.double({ min: 0.1, max: 1, noNaN: true }), (angulo, fraccion) => {
      const desde = { x: 1000, y: 450 };
      const direccion = { x: Math.cos(angulo), y: Math.sin(angulo) };
      const r = recorrer(desde, direccion, OCTAVO * fraccion);
      assert.equal(r.motivoParada, "longitud");
      const dx = r.final.x - desde.x;
      const dy = r.final.y - desde.y;
      const cos = (dx * direccion.x + dy * direccion.y) / Math.hypot(dx, dy);
      assert.ok(Math.acos(Math.min(1, cos)) <= grados(1), `ángulo ${Math.acos(Math.min(1, cos))}`);
    }),
    { numRuns: 500 },
  );
});

test("emp-1: empuje-horizontal, a la derecha y a la izquierda, y más daño llega más lejos", () => {
  const derecha = recorrer({ x: 1000, y: 500 }, { x: 1, y: 0 }, longitudDeEmpuje(MUNDO, 60, 40, 40));
  assert.ok(derecha.final.x - 1000 >= distanciaMinimaDesplazamiento(MUNDO, 60));
  assert.ok(Math.abs(derecha.final.y - 500) <= 1);
  assert.equal(derecha.motivoParada, "longitud");
  const izquierda = recorrer({ x: 1000, y: 500 }, { x: -1, y: 0 }, longitudDeEmpuje(MUNDO, 60, 40, 40));
  assert.ok(izquierda.final.x - 1000 <= -distanciaMinimaDesplazamiento(MUNDO, 60));
  const poco = recorrer({ x: 1000, y: 500 }, { x: 1, y: 0 }, longitudDeEmpuje(MUNDO, 60, 10, 40));
  assert.ok(poco.final.x < derecha.final.x, "con daño 10 recorre menos que con daño 40");
});

// emp-2, caso A: curva hacia el planeta.
test("emp-2: cerca de un planeta el recorrido se curva hacia él y no entra", () => {
  const { mascara, pozos, planeta } = mundoConPlaneta();
  const r = recorrer({ x: 1000, y: 500 }, { x: 1, y: 0 }, OCTAVO, { mascara, pozos });
  assert.ok(r.final.y - 500 < -5, `Δy ${r.final.y - 500}`);
  for (let i = 1; i < r.puntos.length; i++) assert.ok(r.puntos[i].y <= r.puntos[i - 1].y + 1e-9, "y baja de forma monótona");
  for (const p of r.puntos) assert.ok(Math.hypot(p.x - planeta.cx, p.y - planeta.cy) > planeta.radio, "ningún punto dentro del planeta");
});

test("emp-2: el recorrido se para antes de meterse en un planeta", () => {
  const { mascara, pozos, planeta } = mundoConPlaneta();
  const r = recorrer({ x: 1000, y: 500 }, { x: 0, y: -1 }, OCTAVO, { mascara, pozos });
  assert.equal(r.motivoParada, "planeta");
  assert.ok(esPosicionValida(r.final, MUNDO, mascara, []));
  assert.ok(Math.hypot(r.final.x - planeta.cx, r.final.y - planeta.cy) > planeta.radio);
});

// emp-2, casos B y C y sus límites: los cuatro bordes.
const BORDES: readonly { nombre: string; desde: PuntoNave; direccion: PuntoNave; eje: "x" | "y"; sentido: 1 | -1 }[] = [
  { nombre: "derecha y algo arriba → desliza arriba", desde: { x: 1900, y: 500 }, direccion: { x: Math.cos(grados(20)), y: -Math.sin(grados(20)) }, eje: "x", sentido: -1 },
  { nombre: "derecha y algo abajo → desliza abajo", desde: { x: 1900, y: 500 }, direccion: { x: Math.cos(grados(20)), y: Math.sin(grados(20)) }, eje: "x", sentido: 1 },
  { nombre: "derecha exacta → hacia el centro vertical", desde: { x: 1900, y: 300 }, direccion: { x: 1, y: 0 }, eje: "x", sentido: 1 },
  { nombre: "izquierda y algo abajo → desliza abajo", desde: { x: 100, y: 500 }, direccion: { x: -Math.cos(grados(20)), y: Math.sin(grados(20)) }, eje: "x", sentido: 1 },
  { nombre: "arriba y algo a la derecha → desliza a la derecha", desde: { x: 1000, y: 100 }, direccion: { x: Math.sin(grados(20)), y: -Math.cos(grados(20)) }, eje: "y", sentido: 1 },
  { nombre: "arriba y algo a la izquierda → desliza a la izquierda", desde: { x: 1000, y: 100 }, direccion: { x: -Math.sin(grados(20)), y: -Math.cos(grados(20)) }, eje: "y", sentido: -1 },
  { nombre: "arriba exacta → hacia el centro horizontal", desde: { x: 1500, y: 100 }, direccion: { x: 0, y: -1 }, eje: "y", sentido: -1 },
  { nombre: "abajo y algo a la izquierda → desliza a la izquierda", desde: { x: 1000, y: LIMITES.yMax - 30 }, direccion: { x: -Math.sin(grados(20)), y: Math.cos(grados(20)) }, eje: "y", sentido: -1 },
];

for (const caso of BORDES) {
  test(`emp-2: borde, ${caso.nombre}`, () => {
    const r = recorrer(caso.desde, caso.direccion);
    const otroEje = caso.eje === "x" ? "y" : "x";
    // El recorrido llega al borde: a partir de ahí mantiene el eje y avanza en el sentido.
    const iBorde = r.puntos.findIndex((p, i) => i > 0 && Math.abs(p[caso.eje] - r.puntos[i - 1][caso.eje]) < 1e-9 && Math.abs(p[otroEje] - r.puntos[i - 1][otroEje]) > 1);
    assert.ok(iBorde > 0, "hay tramo de deslizamiento");
    for (let i = iBorde; i < r.puntos.length; i++) {
      assert.ok(Math.abs(r.puntos[i][caso.eje] - r.puntos[iBorde][caso.eje]) <= TOLERANCIA_BORDE_U, "mantiene el eje del borde");
      if (i > iBorde) assert.ok((r.puntos[i][otroEje] - r.puntos[i - 1][otroEje]) * caso.sentido > 0, "avanza en el sentido esperado");
    }
    assert.ok(Math.abs(longitudRecorrida(r.puntos) - OCTAVO) <= PASO_EMPUJE_U || r.motivoParada === "esquina", "el recorrido no se acorta");
    for (const p of r.puntos) assert.ok(esPosicionValida(p, MUNDO, VACIO, []));
  });
}

test("emp-2: una esquina detiene el recorrido dentro del mundo", () => {
  const r = recorrer({ x: LIMITES.xMax - 10, y: LIMITES.yMin + 10 }, { x: 1, y: -1 });
  assert.equal(r.motivoParada, "esquina");
  assert.ok(esPosicionValida(r.final, MUNDO, VACIO, []));
});

// Invariantes 2 y 3/4 sobre entradas arbitrarias.
test("emp-2 (invariante 2): para cualquier entrada el recorrido es ≤ OCTAVO + 4 y cada punto es válido", () => {
  const { mascara, pozos } = mundoConPlaneta();
  fc.assert(
    fc.property(
      fc.double({ min: LIMITES.xMin, max: LIMITES.xMax, noNaN: true }),
      fc.double({ min: LIMITES.yMin, max: LIMITES.yMax, noNaN: true }),
      fc.double({ min: -1, max: 1, noNaN: true }),
      fc.double({ min: -1, max: 1, noNaN: true }),
      fc.double({ min: 0, max: OCTAVO, noNaN: true }),
      (x, y, dx, dy, longitud) => {
        const desde = { x, y };
        if (!esPosicionValida(desde, MUNDO, mascara, [])) return;
        const r = recorrer(desde, { x: dx, y: dy }, longitud, { mascara, pozos });
        assert.ok(longitudRecorrida(r.puntos) <= OCTAVO + PASO_EMPUJE_U);
        for (const p of r.puntos) assert.ok(esPosicionValida(p, MUNDO, mascara, []), `punto inválido ${p.x},${p.y}`);
      },
    ),
    { numRuns: 500 },
  );
});

test("emp-2 (invariantes 3 y 4): tras llegar al borde, el eje se mantiene y la componente tangencial manda", () => {
  fc.assert(
    fc.property(fc.constantFrom("izq", "der", "arr", "aba"), fc.double({ min: 0.05, max: Math.PI / 2 - 0.05, noNaN: true }), fc.boolean(), (borde, angulo, signoTangencial) => {
      const s = signoTangencial ? 1 : -1;
      const normal = { izq: { x: -1, y: 0 }, der: { x: 1, y: 0 }, arr: { x: 0, y: -1 }, aba: { x: 0, y: 1 } }[borde];
      const tangente = { x: Math.abs(normal.y), y: Math.abs(normal.x) };
      const direccion = { x: normal.x * Math.cos(angulo) + tangente.x * s * Math.sin(angulo), y: normal.y * Math.cos(angulo) + tangente.y * s * Math.sin(angulo) };
      const desde = {
        izq: { x: LIMITES.xMin + 10, y: 500 },
        der: { x: LIMITES.xMax - 10, y: 500 },
        arr: { x: 1000, y: LIMITES.yMin + 10 },
        aba: { x: 1000, y: LIMITES.yMax - 10 },
      }[borde];
      const eje = normal.x !== 0 ? "x" : "y";
      const otro = eje === "x" ? "y" : "x";
      const r = recorrer(desde, direccion);
      const i = r.puntos.findIndex((p, k) => k > 0 && Math.abs(p[eje] - r.puntos[k - 1][eje]) < 1e-9 && Math.abs(p[otro] - r.puntos[k - 1][otro]) > 1);
      if (i < 0) return; // llegó a una esquina antes de deslizar
      for (let k = i; k < r.puntos.length; k++) {
        assert.ok(Math.abs(r.puntos[k][eje] - r.puntos[i][eje]) <= TOLERANCIA_BORDE_U);
        if (k > i) assert.ok((r.puntos[k][otro] - r.puntos[k - 1][otro]) * s > 0);
      }
    }),
    { numRuns: 500 },
  );
});

// emp-3 (invariante 6): si algún punto de la prolongación pasa el descartar, el destino final lo pasa.
test("emp-3 (invariante 6): el destino final pasa el descartar si algún punto de la prolongación lo pasa", () => {
  fc.assert(
    fc.property(fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), fc.double({ min: 0, max: OCTAVO, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (angulo, corte, longitudFraccion) => {
      const desde = { x: 1000, y: 500 };
      const direccion = { x: Math.cos(angulo), y: Math.sin(angulo) };
      // «Repetir le da» mientras el punto esté a menos de `corte` del origen.
      const descartar = (p: PuntoNave): boolean => Math.hypot(p.x - desde.x, p.y - desde.y) < corte;
      const longitud = OCTAVO * longitudFraccion;
      const r = recolocarTrasImpacto({ desde, direccion, longitud, mundo: MUNDO, mascara: VACIO, otras: [], descartar });
      const camino = recorrer(desde, direccion, OCTAVO);
      const lejano = camino.final;
      const alcanzable = !descartar(lejano);
      if (alcanzable && r.reserva !== "se-queda") assert.ok(!descartar(r), `corte ${corte}, destino a ${Math.hypot(r.x - desde.x, r.y - desde.y)}`);
      if (r.reserva === "ninguna") assert.ok(!descartar(r) || longitud === 0);
    }),
    { numRuns: 500 },
  );
});

// Invariante 5: sin EstadoAleatorio; misma entrada, misma salida.
test("emp (invariante 5): el desplazamiento es una función pura de su entrada", () => {
  fc.assert(
    fc.property(fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), fc.double({ min: 0, max: OCTAVO, noNaN: true }), (angulo, longitud) => {
      const parametros = { desde: { x: 1000, y: 500 }, direccion: { x: Math.cos(angulo), y: Math.sin(angulo) }, longitud, mundo: MUNDO, mascara: VACIO, otras: [] };
      assert.deepEqual(recolocarTrasImpacto(parametros), recolocarTrasImpacto(parametros));
    }),
    { numRuns: 300 },
  );
});
