import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { buscarSolucionRival } from "@/sim/ia/busquedaMultipozo";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";

const NUM_SISTEMAS = 200;
const MINIMO_IMPACTO_DIRECTO = 120;

// ia-n9: se separa de ia-n1 a propósito -- el criterio que bloquea es causar
// daño (ia-n1); este mide la CALIDAD de la puntería, sobre el mismo lote de
// 200 sistemas (misma semilla por índice, así que es literalmente el mismo
// conjunto). Un disparo elegido por la búsqueda "acierta de verdad" cuando
// el resultado es un impacto directo en el casco (imp-1), no solo daño por
// radio de explosión.
test("ia-n9: el disparo elegido termina en impacto directo de casco en >=120/200 sistemas", () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const lote = generarLoteDeSistemas(NUM_SISTEMAS);

  let impactosDirectos = 0;
  for (const { sistema, naveA, naveB, aleatorio } of lote) {
    const parametrosComunes = {
      mascara: sistema.mascara,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      aleatorio,
      arma: armaBase,
      naves: [naveA, naveB],
      tiradorId: 0 as const,
      objetivoId: 1 as const,
    };

    const resultado = buscarSolucionRival(parametrosComunes);
    if (resultado.danioObjetivo <= 0) continue;

    // Re-resuelve el mismo disparo elegido para inspeccionar impactoNave --
    // SolucionRival no lo expone (solo ángulo/potencia/daño), pero es el
    // mismo resolverDisparo con los mismos parámetros: determinista, así que
    // reproduce EXACTAMENTE el vuelo que la búsqueda ya evaluó por dentro.
    const disparo = resolverDisparo({
      mascara: sistema.mascara,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      aleatorio,
      arma: armaBase,
      origenX: naveA.x,
      origenY: naveA.y,
      anguloGrados: resultado.anguloGrados,
      potencia: resultado.potencia,
      objetivoX: naveB.x,
      objetivoY: naveB.y,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      naves: [naveA, naveB],
      tiradorId: 0,
    });
    if (disparo.puntosDeImpacto.some((punto) => punto.impactoNave === 1)) impactosDirectos++;
  }

  console.log(`ia-n9: ${impactosDirectos}/${NUM_SISTEMAS} disparos elegidos terminan en impacto directo de casco`);
  assert.ok(
    impactosDirectos >= MINIMO_IMPACTO_DIRECTO,
    `solo ${impactosDirectos}/${NUM_SISTEMAS} impactos directos (mínimo deseado ${MINIMO_IMPACTO_DIRECTO}) -- ia-n9 es camino_critico:false, si esto falla de verdad se anota en desviaciones, no bloquea el bloque`,
  );
});
