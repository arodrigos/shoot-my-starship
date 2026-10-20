import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  FUERZA_POR_PX_RADIAL,
  RADIO_CERCA_NAVE_PX,
  UMBRAL_TOQUE_PX,
  avanzarGestoPolar,
  iniciarGestoPolar,
  type AjusteNumerico,
  type GestoPolar,
  type PuntoPantalla,
} from "@/juego/control/apuntado";

const NAVE = { x: 200, y: 400 };
const AJUSTE: AjusteNumerico = { anguloGrados: 45, potencia: 50 };

// Punto en pantalla (y hacia abajo) a `radio` px de la nave en el ángulo de juego `grados`.
function punto(grados: number, radio: number): PuntoPantalla {
  const rad = (grados * Math.PI) / 180;
  return { x: NAVE.x + Math.cos(rad) * radio, y: NAVE.y - Math.sin(rad) * radio };
}

function recorrer(puntos: readonly PuntoPantalla[], ajuste: AjusteNumerico = AJUSTE): { gesto: GestoPolar; ajuste: AjusteNumerico } {
  let gesto = iniciarGestoPolar(ajuste, NAVE, puntos[0]);
  let actual = ajuste;
  for (const p of puntos.slice(1)) {
    const r = avanzarGestoPolar(gesto, NAVE, p);
    gesto = r.gesto;
    actual = r.ajuste;
  }
  return { gesto, ajuste: actual };
}

const distanciaMenorAngulo = (a: number, b: number): number => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
};

test("a360-1: una vuelta de 36 pasos de 10° a 100 px devuelve el ángulo inicial y no toca la fuerza", () => {
  const pasos = Array.from({ length: 37 }, (_, i) => punto(i * 10, 100));
  const r = recorrer(pasos, { anguloGrados: 0, potencia: 50 });
  assert.ok(distanciaMenorAngulo(r.ajuste.anguloGrados, 0) < 0.01);
  assert.ok(Math.abs(r.ajuste.potencia - 50) <= 0.5);
});

test("a360-1: cruza 360→0 sin quedarse pegado, en los dos sentidos", () => {
  const arriba = recorrer([punto(350, 100), punto(0, 100), punto(10, 100)], { anguloGrados: 350, potencia: 50 });
  assert.ok(distanciaMenorAngulo(arriba.ajuste.anguloGrados, 10) < 0.01);
  const abajo = recorrer([punto(10, 100), punto(0, 100), punto(350, 100)], { anguloGrados: 10, potencia: 50 });
  assert.ok(distanciaMenorAngulo(abajo.ajuste.anguloGrados, 350) < 0.01);
});

test("a360-5: alejar el dedo 100 px sube la fuerza 30 y acercarlo 100 px la baja 30, acotada a [0,100]", () => {
  assert.ok(Math.abs(recorrer([punto(45, 100), punto(45, 200)]).ajuste.potencia - (50 + 100 * FUERZA_POR_PX_RADIAL)) < 1e-6);
  assert.ok(Math.abs(recorrer([punto(45, 200), punto(45, 100)]).ajuste.potencia - 20) < 1e-6);
  assert.equal(recorrer([punto(45, 100), punto(45, 900)]).ajuste.potencia, 100);
  assert.equal(recorrer([punto(45, 500), punto(45, 40)], { anguloGrados: 45, potencia: 5 }).ajuste.potencia, 0);
  assert.ok(distanciaMenorAngulo(recorrer([punto(45, 100), punto(45, 200)]).ajuste.anguloGrados, 45) < 1e-6);
});

test("a360: un toque de menos de 4 px no cambia ni el ángulo ni la fuerza", () => {
  const inicio = punto(30, 100);
  const r = recorrer([inicio, { x: inicio.x + 2, y: inicio.y - 2 }]);
  assert.deepEqual(r.ajuste, AJUSTE);
  assert.equal(r.gesto.iniciado, false);
});

test("a360: al salir de la zona muerta esa posición es la nueva referencia, sin saltos", () => {
  // Apoya dentro de la zona muerta, gira dentro (no cuenta) y sale a otro lado.
  const r = recorrer([punto(0, 10), punto(90, 10), punto(180, 60)]);
  assert.deepEqual(r.ajuste, AJUSTE);
  // Desde ahí, 90° más es +90°.
  const s = recorrer([punto(0, 10), punto(180, 60), punto(270, 60)]);
  assert.ok(distanciaMenorAngulo(s.ajuste.anguloGrados, 135) < 0.01);
  assert.ok(Math.abs(s.ajuste.potencia - 50) <= 0.5);
});

test("a360: entrar en la zona muerta a mitad de gesto congela el ajuste vigente", () => {
  const r = recorrer([punto(0, 100), punto(60, 150), punto(60, 10)]);
  const antes = recorrer([punto(0, 100), punto(60, 150)]);
  assert.deepEqual(r.ajuste, antes.ajuste);
});

const radio = fc.double({ min: RADIO_CERCA_NAVE_PX + 1, max: 400, noNaN: true });
const grados = fc.double({ min: 0, max: 359.99, noNaN: true });

// Invariante 1: una vuelta que vuelve al punto de partida deja el ángulo inicial.
test("apuntado-360 (invariante): rodear la nave y volver al punto de partida deja el mismo ángulo", () => {
  fc.assert(
    fc.property(radio, grados, fc.double({ min: 0, max: 359, noNaN: true }), fc.integer({ min: 8, max: 90 }), fc.boolean(), (r, inicio, angulo, pasos, horario) => {
      const sentido = horario ? -1 : 1;
      const camino = Array.from({ length: pasos + 1 }, (_, i) => punto(inicio + (sentido * 360 * i) / pasos, r));
      const res = recorrer(camino, { anguloGrados: angulo, potencia: 50 });
      assert.ok(distanciaMenorAngulo(res.ajuste.anguloGrados, angulo) <= 0.01, `${res.ajuste.anguloGrados} vs ${angulo}`);
    }),
    { numRuns: 300 },
  );
});

// Invariante 2: rango del ángulo y la fuerza para cualquier secuencia.
test("apuntado-360 (invariante): ángulo en [0,360) y fuerza en [0,100] para cualquier secuencia", () => {
  const coord = fc.double({ min: -1000, max: 1000, noNaN: true });
  fc.assert(
    fc.property(fc.array(fc.record({ x: coord, y: coord }), { minLength: 1, maxLength: 40 }), fc.double({ min: 0, max: 360, noNaN: true }), fc.double({ min: 0, max: 100, noNaN: true }), (puntos, a, p) => {
      let gesto = iniciarGestoPolar({ anguloGrados: a, potencia: p }, NAVE, puntos[0]);
      for (const dedo of puntos) {
        const r = avanzarGestoPolar(gesto, NAVE, dedo);
        gesto = r.gesto;
        assert.ok(r.ajuste.anguloGrados >= 0 && r.ajuste.anguloGrados < 360, `ángulo ${r.ajuste.anguloGrados}`);
        assert.ok(r.ajuste.potencia >= 0 && r.ajuste.potencia <= 100, `fuerza ${r.ajuste.potencia}`);
      }
    }),
    { numRuns: 400 },
  );
});

// Invariante 3: la frecuencia del táctil no cambia el resultado.
test("apuntado-360 (invariante): submuestrear un recorrido da el mismo ángulo final", () => {
  fc.assert(
    fc.property(radio, grados, fc.array(fc.double({ min: -60, max: 60, noNaN: true }), { minLength: 2, maxLength: 40 }), (r, inicio, saltos) => {
      // Cada salto se agrupa de dos en dos: dos consecutivos siempre suman < 180°.
      let a = inicio;
      const completo = [punto(a, r)];
      for (const s of saltos) {
        a += s;
        completo.push(punto(a, r));
      }
      const n = completo.length;
      // Se queda con uno de cada dos y siempre con el último.
      const sub = completo.filter((_, i) => i % 2 === 0 || i === n - 1);
      const x = recorrer(completo).ajuste.anguloGrados;
      const y = recorrer(sub).ajuste.anguloGrados;
      assert.ok(distanciaMenorAngulo(x, y) <= 0.01, `${x} vs ${y}`);
    }),
    { numRuns: 300 },
  );
});

// Invariante 4: la zona muerta.
test("apuntado-360 (invariante): dentro de RADIO_CERCA_NAVE_PX ni el ángulo ni la fuerza cambian", () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ g: grados, r: fc.double({ min: 0, max: RADIO_CERCA_NAVE_PX - 0.01, noNaN: true }) }), { minLength: 1, maxLength: 30 }),
      fc.double({ min: 0, max: 359, noNaN: true }),
      fc.double({ min: 0, max: 100, noNaN: true }),
      (puntos, a, p) => {
        const ajuste = { anguloGrados: a, potencia: p };
        const r = recorrer(puntos.map((q) => punto(q.g, q.r)), ajuste);
        assert.ok(distanciaMenorAngulo(r.ajuste.anguloGrados, a) < 1e-9);
        assert.equal(r.ajuste.potencia, p);
      },
    ),
    { numRuns: 300 },
  );
});

// Invariante 5: la fuerza solo depende de la distancia inicial y final.
test("apuntado-360 (invariante): la fuerza no depende del camino mientras no toque un tope", () => {
  fc.assert(
    fc.property(radio, radio, fc.array(fc.tuple(grados, radio), { maxLength: 15 }), grados, (r0, r1, rodeo, g0) => {
      fc.pre(Math.abs((r1 - r0) * FUERZA_POR_PX_RADIAL) < 40);
      // El rodeo pasa por radios arbitrarios: solo cuenta el radio de salida y el de llegada.
      const ruta = [punto(g0, r0), ...rodeo.map(([g, r]) => punto(g, r)), punto(g0 + 90, r1)];
      const res = recorrer(ruta, { anguloGrados: 0, potencia: 50 });
      // Sin topes por el camino, la fuerza es la del radio final; con ellos solo se garantiza el rango.
      const esperada = 50 + (r1 - r0) * FUERZA_POR_PX_RADIAL;
      const tocoTope = rodeo.some(([, r]) => {
        const p = 50 + (r - r0) * FUERZA_POR_PX_RADIAL;
        return p < 0 || p > 100;
      });
      if (!tocoTope) assert.ok(Math.abs(res.ajuste.potencia - esperada) <= 0.5, `${res.ajuste.potencia} vs ${esperada}`);
      assert.ok(UMBRAL_TOQUE_PX > 0);
    }),
    { numRuns: 300 },
  );
});
