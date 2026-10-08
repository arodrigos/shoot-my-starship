import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { existeTiroViable } from "@/sim/balistica/rejilla";
import { buscarSolucionRival } from "@/sim/ia/busquedaMultipozo";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";
import { muestra } from "../../utils/muestra";

const NUM_SISTEMAS = muestra(200);
const PRESUPUESTO_SIN_TECHO = 100_000;

// ia-n10: cierra explícitamente el fallo que costó la iteración 1 de este
// run -- dos definiciones de "hay tiro" conviviendo, cada una pasando sus
// propios tests. Ambas rutas (colocación y rival) comparten barridoRejilla:
// si existeTiroViable declara viable una colocación, buscarSolucionRival
// (con la MISMA arma base) tiene que encontrar en ella un disparo con daño
// real. No debe haber ni un solo caso en el que una diga sí y la otra no
// encuentre nada.
test(`ia-n10: colocación y rival nunca discrepan sobre si hay tiro, en ${NUM_SISTEMAS} sistemas`, () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const lote = generarLoteDeSistemas(NUM_SISTEMAS);

  const discrepancias: number[] = [];
  for (const { semilla, sistema, naveA, naveB, aleatorio } of lote) {
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

    const viable = existeTiroViable(parametrosComunes);
    // Sin techo de vuelos: el único tiro viable de un sistema puede caer en
    // la fila de potencia 85 %, fuera del presupuesto de un turno normal
    // (192). Ese techo lo vigila ia-n3; aquí se comprueba que los dos
    // oráculos comparten criterio, no cuánto cómputo se le da al rival.
    const resultado = buscarSolucionRival({ ...parametrosComunes, presupuestoVuelosMax: PRESUPUESTO_SIN_TECHO });
    const rivalEncuentraDanio = resultado.danioObjetivo > 0;

    if (viable !== rivalEncuentraDanio) discrepancias.push(semilla);
  }

  console.log(`ia-n10: ${discrepancias.length}/${NUM_SISTEMAS} discrepancias entre existeTiroViable y buscarSolucionRival`);
  assert.deepEqual(discrepancias, [], `existeTiroViable y buscarSolucionRival discreparon en las semillas: ${JSON.stringify(discrepancias)}`);
});
