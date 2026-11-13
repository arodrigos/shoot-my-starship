import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { aplicarHuellaDeArma, resolverDisparo, type ParametrosResolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { calcularAbanicoPrevisualizacion } from "@/sim/armas/previsualizacion";
import { clonarMascara } from "@/sim/armas/resolver";
import { esSolido } from "@/sim/terreno/mascara";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const SUELO_Y = 900;
const HIPO = buscarArma("hipo-triple");
const PEPINAZO = buscarArma("pepinazo-cortesia");
const FACTORES = [1, 0.8, 0.6];

function parametros(sobre: Partial<ParametrosResolverDisparo> & Pick<ParametrosResolverDisparo, "arma">): ParametrosResolverDisparo {
  return {
    mascara: crearMascaraPlana(ANCHO, ALTO, SUELO_Y),
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(7),
    origenX: 300,
    anguloGrados: 45,
    potencia: 70,
    objetivoX: 1500,
    objetivoY: SUELO_Y,
    ancho: ANCHO,
    alto: ALTO,
    ...sobre,
  };
}

test("raf-1: tres vuelos que equivalen a tres disparos simples a p, 0,8p y 0,6p con la huella aplicada entre cada uno", () => {
  const rafaga = resolverDisparo(parametros({ arma: HIPO, potencia: 80 }));
  let mascara = crearMascaraPlana(ANCHO, ALTO, SUELO_Y);
  const manuales: { x: number; y: number }[] = [];
  for (const factor of FACTORES) {
    const simple = resolverDisparo(parametros({ arma: { ...HIPO, comportamiento: { tipo: "impacto-simple" } }, mascara, potencia: 80 * factor }));
    manuales.push(simple.puntosDeImpacto[0]);
    mascara = clonarMascara(mascara);
    aplicarHuellaDeArma(mascara, HIPO, simple.puntosDeImpacto[0]);
  }
  assert.equal(rafaga.puntosDeImpacto.length, 3);
  rafaga.puntosDeImpacto.forEach((p, i) => {
    assert.ok(Math.abs(p.x - manuales[i].x) < 1e-9 && Math.abs(p.y - manuales[i].y) < 1e-9, `vuelo ${i}`);
  });
  const xs = rafaga.puntosDeImpacto.map((p) => p.x);
  assert.ok(xs[0] > xs[1] && xs[1] > xs[2], "la distancia es estrictamente decreciente en suelo plano");
});

test("raf-1: el segundo vuelo atraviesa el cráter que dejó el primero", () => {
  // Con los dos primeros impactos casi en el mismo punto, el segundo cae más
  // hondo que sobre el suelo intacto.
  const arma = { ...HIPO, comportamiento: { tipo: "rafaga", factoresPotencia: [1, 1] } as const };
  const r = resolverDisparo(parametros({ arma }));
  assert.ok(r.puntosDeImpacto[1].y > r.puntosDeImpacto[0].y, "el segundo vuelo cae dentro del cráter");
  assert.equal(esSolido(r.mascara, Math.round(r.puntosDeImpacto[0].x), SUELO_Y - 1), false);
});

test("raf-1: un vuelo perdido no impide los demás", () => {
  const arma = { ...HIPO, comportamiento: { tipo: "rafaga", factoresPotencia: [1, 0.5, 0.4] } as const };
  const r = resolverDisparo(parametros({ arma, potencia: 100, origenX: 1000, anguloGrados: 45 }));
  assert.equal(r.proyectilPerdido, false);
  assert.equal(r.puntosDeImpacto.length, 2);
});

test("raf-1 (invariantes): factoresPotencia.length vuelos en orden, determinista y equivalente a vuelos sucesivos", () => {
  fc.assert(
    fc.property(fc.integer({ min: 20, max: 80 }), fc.integer({ min: 40, max: 85 }), fc.integer({ min: 1, max: 1000 }), (angulo, potencia, semilla) => {
      const p = parametros({ arma: HIPO, anguloGrados: angulo, potencia, aleatorio: crearEstadoAleatorio(semilla) });
      const a = resolverDisparo(p);
      const b = resolverDisparo(p);
      assert.deepEqual(a.puntosDeImpacto, b.puntosDeImpacto, "determinismo");
      if (a.proyectilPerdido) return;
      assert.ok(a.puntosDeImpacto.length <= FACTORES.length);
      // Equivalencia con vuelos sucesivos sobre la máscara que deja el anterior.
      let mascara = crearMascaraPlana(ANCHO, ALTO, SUELO_Y);
      const esperados: number[] = [];
      for (const factor of FACTORES) {
        const s = resolverDisparo(
          parametros({ arma: { ...HIPO, comportamiento: { tipo: "impacto-simple" } }, mascara, anguloGrados: angulo, potencia: potencia * factor, aleatorio: crearEstadoAleatorio(semilla) }),
        );
        if (s.proyectilPerdido) continue;
        esperados.push(s.puntosDeImpacto[0].x);
        mascara = clonarMascara(mascara);
        aplicarHuellaDeArma(mascara, HIPO, s.puntosDeImpacto[0]);
      }
      assert.deepEqual(a.puntosDeImpacto.map((q) => q.x), esperados);
    }),
    { numRuns: 40 },
  );
});

test("raf-3: ficha completa y arcos de previsualización de los vuelos 2.º y 3.º", () => {
  assert.equal(HIPO.verbo, "tantear");
  assert.equal(HIPO.notaAyuda, "Tres tiros seguidos, cada uno más corto: tantea y corrige en el mismo turno.");
  assert.ok(HIPO.rol && HIPO.rol.length > 0);
  const inicio = performance.now();
  const abanico = calcularAbanicoPrevisualizacion(
    { ...parametros({ arma: HIPO }), comportamiento: HIPO.comportamiento, origenY: SUELO_Y, longitudMundoMax: 600 },
    8,
    25,
  );
  const ms = performance.now() - inicio;
  assert.equal(abanico.arcosRafaga.length, 2);
  assert.ok(abanico.arcosRafaga.every((arco) => arco.length >= 2));
  // Presupuesto holgado: los cinco cálculos del abanico más los dos arcos.
  assert.ok(ms < 500, `la mira tarda ${ms.toFixed(0)} ms`);
  const sinRafaga = calcularAbanicoPrevisualizacion(
    { ...parametros({ arma: PEPINAZO }), comportamiento: PEPINAZO.comportamiento, origenY: SUELO_Y, longitudMundoMax: 600 },
    8,
    25,
  );
  assert.equal(sinRafaga.arcosRafaga.length, 0);
});

test("raf-4: con error de potencia, la ráfaga da con el objetivo donde el Pepinazo falla", () => {
  // Se busca la potencia que clava el Pepinazo en el objetivo y se le inyecta
  // un exceso de fuerza: el Pepinazo se pasa y el 0,8·p de la ráfaga acierta.
  let mejor: { p: number; x: number } | null = null;
  for (let p = 40; p <= 90; p += 0.25) {
    const x = resolverDisparo(parametros({ arma: PEPINAZO, potencia: p })).puntosDeImpacto[0].x;
    if (mejor === null || Math.abs(x - 1200) < Math.abs(mejor.x - 1200)) mejor = { p, x };
  }
  const objetivoX = mejor!.x;
  let ganaLaRafaga = false;
  for (const exceso of [1.1, 1.15, 1.2, 1.25]) {
    const p = mejor!.p * exceso;
    const pepinazo = resolverDisparo(parametros({ arma: PEPINAZO, potencia: p, objetivoX })).danioObjetivo;
    const hipo = resolverDisparo(parametros({ arma: HIPO, potencia: p, objetivoX })).danioObjetivo;
    if (hipo > pepinazo) ganaLaRafaga = true;
  }
  assert.ok(ganaLaRafaga, "en ningún exceso de potencia la ráfaga supera al Pepinazo");
});
