import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { buscarSolucionRival } from "@/sim/ia/busquedaMultipozo";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";

const NUM_SISTEMAS = 200;
const MINIMO_CON_DANIO = 190;

// ia-n1: "causar daño" sustituye a la formulación anterior ("terminar a
// menos de una tolerancia"), que era inverificable porque nada detenía el
// proyectil en la nave (imp-8, la iteración que costó ese hallazgo). Sobre
// 200 sistemas con colocación ya garantizada viable, la búsqueda del rival
// (rejilla + refinamiento + resolutor real) debe encontrar un disparo con
// daño > 0 en al menos 190.
test("ia-n1: la búsqueda del rival encuentra un disparo con daño real en >=190/200 sistemas", () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const lote = generarLoteDeSistemas(NUM_SISTEMAS);

  let conDanio = 0;
  const fallos: number[] = [];
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
    });
    if (resultado.danioObjetivo > 0) conDanio++;
    else fallos.push(semilla);
  }

  console.log(`ia-n1: ${conDanio}/${NUM_SISTEMAS} sistemas con daño real (fallos: ${JSON.stringify(fallos)})`);
  assert.ok(
    conDanio >= MINIMO_CON_DANIO,
    `solo ${conDanio}/${NUM_SISTEMAS} sistemas obtuvieron un disparo con daño real (mínimo exigido ${MINIMO_CON_DANIO})`,
  );
});
