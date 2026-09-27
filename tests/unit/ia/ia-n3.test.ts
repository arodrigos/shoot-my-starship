import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { PRESUPUESTO_VUELOS_RIVAL_DEFAULT, buscarSolucionRival, type SolucionRival } from "@/sim/ia/busquedaMultipozo";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";

const TECHO_VUELOS = 1200;
const TECHO_MS_CPU = 250;
const NUM_SISTEMAS_TECHO = 30;
const PRESUPUESTO_AGOTADO = 10;

// ia-n3: el techo es de VUELOS y de CPU, medidos, nunca de tiempo de reloj de
// pared (que en CI compartido depende de cuánta otra cosa esté corriendo a la
// vez) -- por eso process.cpuUsage(), no Date.now()/hrtime de pared.
test("ia-n3: el turno del rival nunca supera 1.200 vuelos ni 250 ms de CPU, y con presupuesto agotado devuelve mejor esfuerzo sin excepción", () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const lote = generarLoteDeSistemas(NUM_SISTEMAS_TECHO);

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

    const cpuAntes = process.cpuUsage();
    const resultado = buscarSolucionRival(parametrosComunes);
    const cpuMs = (process.cpuUsage(cpuAntes).user + process.cpuUsage(cpuAntes).system) / 1000;

    assert.ok(
      resultado.vuelosSimulados <= TECHO_VUELOS,
      `semilla ${semilla}: ${resultado.vuelosSimulados} vuelos simulados, techo ${TECHO_VUELOS}`,
    );
    assert.ok(cpuMs <= TECHO_MS_CPU, `semilla ${semilla}: ${cpuMs.toFixed(1)} ms de CPU, techo ${TECHO_MS_CPU}`);
    assert.ok(Number.isFinite(resultado.anguloGrados) && Number.isFinite(resultado.potencia));
  }

  // Presupuesto por defecto: nunca ronda la cota (233 vuelos, rejilla +
  // refinamiento + sonda), muy por debajo del techo duro de 1.200.
  assert.ok(PRESUPUESTO_VUELOS_RIVAL_DEFAULT <= TECHO_VUELOS);
});

test("ia-n3: con presupuesto agotado antes de terminar la rejilla, devuelve el mejor esfuerzo, nunca una excepción ni una espera abierta", () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const lote = generarLoteDeSistemas(20);

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
      presupuestoVuelosMax: PRESUPUESTO_AGOTADO,
    };

    let resultado: SolucionRival | undefined;
    assert.doesNotThrow(() => {
      resultado = buscarSolucionRival(parametrosComunes);
    }, `semilla ${semilla}: buscarSolucionRival no debe lanzar aunque el presupuesto (${PRESUPUESTO_AGOTADO}) sea menor que la rejilla entera`);

    assert.ok(resultado !== undefined);
    assert.ok(resultado!.vuelosSimulados <= PRESUPUESTO_AGOTADO, `semilla ${semilla}: gastó más vuelos que el presupuesto asignado`);
    assert.ok(Number.isFinite(resultado!.anguloGrados) && Number.isFinite(resultado!.potencia) && Number.isFinite(resultado!.danioObjetivo));
    assert.equal(typeof resultado!.agotado, "boolean");
  }
});
