import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  ARCO_SALTO_MS,
  DURACION_SALTO_MS,
  duracionPropulsoresMs,
  duracionSaltosMs,
  easeInOut,
  longitudDeRuta,
  muestraDeSalto,
  PAUSA_ATERRIZAJE_MS,
  puntoDelRecorrido,
  REALCE_SALTO_MS,
} from "@/juego/vuelo/ritmo";

const punto = fc.record({ x: fc.double({ min: 0, max: 1000, noNaN: true }), y: fc.double({ min: 0, max: 1800, noNaN: true }) });

// Invariante de propulsores-duracion: clamp(L / 300 u/s, 1500, 3000) ms.
test("rit-1: la duración de los propulsores es clamp(L/300 u/s, 1500, 3000) ms y a la mitad con movimiento reducido", () => {
  fc.assert(
    fc.property(fc.double({ min: 0, max: 5000, noNaN: true }), (longitud) => {
      const esperada = Math.min(3000, Math.max(1500, (longitud / 300) * 1000));
      assert.equal(duracionPropulsoresMs(longitud, false), esperada);
      assert.equal(duracionPropulsoresMs(longitud, true), esperada / 2);
      assert.ok(duracionPropulsoresMs(longitud, false) >= 1500 && duracionPropulsoresMs(longitud, false) <= 3000);
      assert.ok(duracionPropulsoresMs(longitud, true) >= 750 && duracionPropulsoresMs(longitud, true) <= 1500);
    }),
  );
  assert.equal(duracionPropulsoresMs(20, false), 1500);
});

test("rit-1: aceleración y frenada: easeInOut es monótona, va de 0 a 1 y su pico de velocidad es el doble de la media", () => {
  fc.assert(
    fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (a, b) => {
      const [menor, mayor] = a <= b ? [a, b] : [b, a];
      assert.ok(easeInOut(menor) <= easeInOut(mayor) + 1e-12);
      assert.ok(easeInOut(a) >= 0 && easeInOut(a) <= 1);
    }),
  );
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.ok(Math.abs(easeInOut(0.5) - 0.5) < 1e-12);
});

test("rit-1: el recorrido termina exactamente en el último punto de la ruta y nunca se sale de ella", () => {
  fc.assert(
    fc.property(fc.array(punto, { minLength: 2, maxLength: 12 }), fc.double({ min: 0, max: 1, noNaN: true }), (ruta, t) => {
      const final = puntoDelRecorrido(ruta, 1);
      assert.ok(Math.hypot(final.x - ruta[ruta.length - 1].x, final.y - ruta[ruta.length - 1].y) < 1e-6);
      // La distancia recorrida hasta el punto no supera la longitud total.
      const medio = puntoDelRecorrido(ruta, t);
      assert.ok(Math.hypot(medio.x - ruta[0].x, medio.y - ruta[0].y) <= longitudDeRuta(ruta) + 1e-6);
    }),
  );
});

// Invariante de robot-salto-visible: n × (300 + 1100 + 300) ms y posición final = la del núcleo.
test("rit-2: n saltos duran n × 1700 ms (la mitad con movimiento reducido)", () => {
  assert.equal(DURACION_SALTO_MS, 1700);
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 4 }), (saltos) => {
      assert.equal(duracionSaltosMs(saltos, false), saltos * (300 + 1100 + 300));
      assert.equal(duracionSaltosMs(saltos, true), (saltos * 1700) / 2);
    }),
  );
  assert.ok(duracionSaltosMs(4, false) <= 6800);
});

test("rit-2: el salto se queda quieto en el realce, vuela en el arco y termina en el destino (± 1 u)", () => {
  fc.assert(
    fc.property(punto, punto, fc.double({ min: 0, max: DURACION_SALTO_MS, noNaN: true }), fc.boolean(), (desde, hasta, ms, reducido) => {
      const escala = reducido ? 0.5 : 1;
      const muestra = muestraDeSalto(desde, hasta, ms * escala, escala);
      if (muestra.fase === "realce") assert.ok(muestra.x === desde.x && muestra.y === desde.y);
      if (muestra.fase === "pausa") assert.ok(Math.hypot(muestra.x - hasta.x, muestra.y - hasta.y) <= 1);
      const fin = muestraDeSalto(desde, hasta, DURACION_SALTO_MS * escala, escala);
      assert.ok(Math.hypot(fin.x - hasta.x, fin.y - hasta.y) <= 1);
    }),
  );
  // En mitad del arco el robot está por encima de la recta (y del mundo crece hacia abajo).
  const medio = muestraDeSalto({ x: 0, y: 500 }, { x: 400, y: 500 }, REALCE_SALTO_MS + ARCO_SALTO_MS / 2);
  assert.equal(medio.fase, "arco");
  assert.ok(medio.y < 500 - 20);
  assert.ok(REALCE_SALTO_MS + ARCO_SALTO_MS + PAUSA_ATERRIZAJE_MS === DURACION_SALTO_MS);
});
