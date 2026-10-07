import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { buscarArma } from "@/sim/armas/catalogo";
import { PRESUPUESTO_VUELOS_RIVAL_TURNO, buscarSolucionRival, elegirPorValorEsperado } from "@/sim/ia/busquedaMultipozo";
import { PESO_AUTODANIO, compararCandidatos, type CandidatoDisparo } from "@/sim/balistica/rejilla";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";

function candidato(potencia: number, danio: number, autodanioTotal = 0): CandidatoDisparo {
  return { anguloGrados: 45, potencia, danio, autodanioTotal, puntuacion: danio - PESO_AUTODANIO * autodanioTotal, pasosVuelo: 10 };
}

// El escenario que pide el criterio: a potencia 100 el MEJOR CASO es el de
// más daño (40), pero bajo dispersión rara vez acierta (valor esperado 9);
// el tiro a 60 hace menos en el mejor caso (25) y casi siempre acierta
// (valor esperado 22). El ranking tiene que quedarse con el de 60.
test("potencia-dispersion-5: el ranking elige por valor esperado, no por mejor caso", () => {
  const actualMejorCaso = candidato(100, 9); // media de las muestras del ganador de las fases 1-2b
  const alternativoEsperadoAlto = candidato(60, 22);
  assert.equal(elegirPorValorEsperado(actualMejorCaso, [alternativoEsperadoAlto]), alternativoEsperadoAlto);
});

test("potencia-dispersion-5: un alternativo sin daño esperado nunca gana, y el empate conserva el actual", () => {
  const actual = candidato(80, 12);
  assert.equal(elegirPorValorEsperado(actual, [candidato(30, 0)]), actual);
  assert.equal(elegirPorValorEsperado(actual, [candidato(70, 12)]), actual);
  const conAutodanio = candidato(50, 30, 2);
  assert.equal(elegirPorValorEsperado(actual, [conAutodanio]), actual, "ni con más daño se prefiere un tiro que se autoimpacta");
});

test("potencia-dispersion-5: propiedad -- el elegido nunca es peor que el actual y nunca hace daño esperado 0 salvo que sea el actual", () => {
  const arbCandidato = fc
    .record({ potencia: fc.integer({ min: 0, max: 100 }), danio: fc.integer({ min: 0, max: 60 }), autodanio: fc.integer({ min: 0, max: 20 }) })
    .map(({ potencia, danio, autodanio }) => candidato(potencia, danio, autodanio));
  fc.assert(
    fc.property(arbCandidato, fc.array(arbCandidato, { maxLength: 4 }), (actual, alternativos) => {
      const elegido = elegirPorValorEsperado(actual, alternativos);
      assert.ok(compararCandidatos(elegido, actual) <= 0);
      assert.ok(elegido === actual || elegido.danio > 0);
    }),
    { numRuns: 300 },
  );
});

// Integración con el buscador real: en el lote de sistemas generados hay
// casos donde el reordenamiento cambia el tiro de mejor caso, y el turno
// nunca pasa del techo de vuelos de ia-punteria-2. El reordenamiento es raro
// (unos 4 sistemas de cada 120 desde que el daño se mide contra la silueta
// visible), así que el lote es de 90 para que el caso aparezca con margen.
test("potencia-dispersion-5: en sistemas reales el reordenamiento por valor esperado se aplica y respeta el techo de 192 vuelos", () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  let reordenados = 0;
  const lote = generarLoteDeSistemas(90);
  for (const { semilla, sistema, naveA, naveB, aleatorio } of lote) {
    const resultado = buscarSolucionRival({
      mascara: sistema.mascara,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      aleatorio,
      arma: armaBase,
      naves: [naveA, naveB],
      tiradorId: 0,
      objetivoId: 1,
      presupuestoVuelosMax: PRESUPUESTO_VUELOS_RIVAL_TURNO,
    });
    assert.ok(resultado.vuelosSimulados <= PRESUPUESTO_VUELOS_RIVAL_TURNO, `semilla ${semilla}: ${resultado.vuelosSimulados} vuelos`);
    if (resultado.reordenadoPorValorEsperado) reordenados++;
  }
  assert.ok(reordenados > 0, "en 90 sistemas el valor esperado nunca cambió el tiro de mejor caso: el reordenamiento no hace nada");
});
