import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { buscarArma, CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { radioEfectoEnMundo } from "@/sim/armas/radioEfecto";
import { crearMascaraVacia, SOLIDO, type Mascara } from "@/sim/terreno/mascara";
import { crearMascaraPlana } from "../../utils/terrenoPlano";
import { PERSONALIDADES } from "@/sim/ia/personalidades";

const ANCHO = 1046;
const ALTO = 1859;
const ORIGEN_Y = 900;
const FILA = ORIGEN_Y - 26; // ALTURA_CANON_PX del resolutor

// cat-1 (invariante 1): ningún par de armas del catálogo repite verbo.
test("cat-1 (propiedad): para todo par de armas distintas del catálogo, el verbo es distinto", () => {
  const ids = CATALOGO_ARMAS.map((a) => a.id);
  fc.assert(
    fc.property(fc.constantFrom(...ids), fc.constantFrom(...ids), (a, b) => {
      fc.pre(a !== b);
      const va = buscarArma(a).verbo;
      const vb = buscarArma(b).verbo;
      assert.ok(va !== undefined && vb !== undefined && va.trim().length > 0, "toda arma declara verbo");
      assert.notEqual(va, vb);
    }),
    { numRuns: 300 },
  );
});

test("cat-1: Tostadora y Andanada ya no están en el catálogo ni en las personalidades de la IA", () => {
  const retiradas = ["tostadora-orbital", "andanada-de-flechas"];
  for (const id of retiradas) {
    assert.equal(CATALOGO_ARMAS.some((a) => a.id === id), false);
    for (const p of PERSONALIDADES) assert.equal(p.ordenPreferenciaArmas.includes(id), false);
  }
});

function muroEntre(grosor: number): Mascara {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  for (let y = FILA - 40; y < FILA + 40; y++) {
    for (let x = 300; x < 300 + grosor; x++) mascara.datos[y * ANCHO + x] = SOLIDO;
  }
  return mascara;
}

function laser(mascara: Mascara) {
  return resolverDisparo({
    mascara,
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(3),
    arma: buscarArma("rayo-laser"),
    origenX: 100,
    origenY: ORIGEN_Y,
    anguloGrados: 0,
    potencia: 60,
    objetivoX: 700,
    objetivoY: FILA,
    ancho: ANCHO,
    alto: ALTO,
    naves: [{ id: 1, x: 700, y: FILA }],
    tiradorId: 0,
  });
}

// cat-2: 30 u de roca se cruzan (el rival de detrás recibe daño); 50 u frenan el haz.
test("cat-2: el láser atraviesa 30 u de roca y daña al rival; con 50 u no llega", () => {
  assert.ok(laser(muroEntre(30)).danioObjetivo > 0, "con 30 u de roca el rival debe recibir daño");
  assert.equal(laser(muroEntre(50)).danioObjetivo, 0, "con 50 u de roca el haz se queda en la roca");
});

function gancho(mascara: Mascara, objetivoX: number, objetivoY: number, extra: object = {}) {
  return resolverDisparo({
    mascara,
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(5),
    arma: buscarArma("gancho-pegajoso"),
    origenX: 100,
    origenY: ORIGEN_Y,
    anguloGrados: 0,
    potencia: 60,
    objetivoX,
    objetivoY,
    ancho: ANCHO,
    alto: ALTO,
    ...extra,
  });
}

// Suelo plano en y=ORIGEN_Y+200: el gancho se ancla a él.
function sueloPlano(): Mascara {
  return crearMascaraPlana(ANCHO, ALTO, ORIGEN_Y + 200);
}

test("cat-4: la onda del gancho daña menos cuanto más lejos y su radio es 1/8 de la diagonal", () => {
  const arma = buscarArma("gancho-pegajoso");
  const octavo = radioEfectoEnMundo(arma, ANCHO, ALTO);
  assert.ok(Math.abs(octavo - Math.hypot(ANCHO, ALTO) / 8) < 1e-9);
  const base = gancho(sueloPlano(), 0, 0);
  assert.equal(base.proyectilPerdido, false);
  const p = base.puntosDeImpacto[0];
  const danioA = gancho(sueloPlano(), p.x + 0.25 * octavo, p.y).danioObjetivo;
  const danioB = gancho(sueloPlano(), p.x + 0.75 * octavo, p.y).danioObjetivo;
  const danioFuera = gancho(sueloPlano(), p.x + octavo + 3, p.y).danioObjetivo;
  assert.ok(danioA > danioB && danioB > 0, `A=${danioA} B=${danioB}`);
  assert.equal(danioFuera, 0);
  const dmax = arma.efecto.tipo === "danio" ? arma.efecto.danioMaximo : 0;
  assert.ok(Math.abs(danioA - Math.round(dmax * 0.75)) <= 1);
});

test("cat-4 (propiedad): el daño de la onda es max(0, dmax·(1−d/octavo)) para cualquier distancia", () => {
  const arma = buscarArma("gancho-pegajoso");
  const octavo = radioEfectoEnMundo(arma, ANCHO, ALTO);
  const dmax = arma.efecto.tipo === "danio" ? arma.efecto.danioMaximo : 0;
  const p = gancho(sueloPlano(), 0, 0).puntosDeImpacto[0];
  fc.assert(
    fc.property(fc.double({ min: 0, max: 2 * octavo, noNaN: true }), (d) => {
      const danio = gancho(sueloPlano(), p.x + d, p.y).danioObjetivo;
      const esperado = Math.max(0, Math.round(dmax * (1 - d / octavo)));
      assert.ok(Math.abs(danio - esperado) <= 1, `d=${d} danio=${danio} esperado=${esperado}`);
    }),
    { numRuns: 100 },
  );
});

test("cat-4: la onda del gancho nunca daña al tirador, ni siquiera pegado a su casco", () => {
  const r = gancho(sueloPlano(), 700, ORIGEN_Y, {
    naves: [{ id: 0, x: 130, y: ORIGEN_Y }],
    tiradorId: 0,
  });
  assert.equal(r.impactoPropio, null);
  assert.equal(r.danioPropio, 0);
});

// cat-4 (invariante 3): un gancho que sale del mundo sin tocar nada se pierde.
test("cat-4 (propiedad): un gancho que sale del mundo sin tocar sólido ni casco se pierde sin daño ni cambio de máscara", () => {
  fc.assert(
    fc.property(fc.double({ min: 20, max: 100, noNaN: true }), fc.double({ min: 0, max: 20, noNaN: true }), (potencia, angulo) => {
      const mascara = crearMascaraVacia(ANCHO, ALTO);
      const antes = new Uint8Array(mascara.datos);
      const r = gancho(mascara, 500, 500, { potencia, anguloGrados: angulo });
      assert.equal(r.proyectilPerdido, true);
      assert.equal(r.danioObjetivo, 0);
      assert.deepEqual(Array.from(r.mascara.datos), Array.from(antes));
    }),
    { numRuns: 25 },
  );
});
