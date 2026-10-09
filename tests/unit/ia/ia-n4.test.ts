import { test } from "node:test";
import assert from "node:assert/strict";
import { siguienteAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { existeTiroViable } from "@/sim/balistica/rejilla";
import { buscarSolucionRival, PRESUPUESTO_VUELOS_RIVAL_TURNO } from "@/sim/ia/busquedaMultipozo";
import {
  calcularErrorInyectado,
  calcularFactorSensibilidad,
  calcularFactorSensibilidadPotencia,
  decidirTurnoIA,
  evitarAutoimpactoConReintento,
} from "@/sim/ia/decidir";
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";
import { muestra } from "../../utils/muestra";

const NUM_SISTEMAS = muestra(200);
// Réplica de decidir.ts (ARMA_BASE_ID/PRESUPUESTO_VIABILIDAD_REFERENCIA, no
// exportadas a propósito -- son detalle interno, no contrato público): el
// mismo criterio de "bloqueada" que ia-n10 exige que comparta con colocación.
const ARMA_BASE_ID = "pepinazo-cortesia";
const PRESUPUESTO_VIABILIDAD_REFERENCIA = 40;

test("ia-n4a: el error inyectado sigue siendo exactamente la diferencia entre la solución hallada y la entrada emitida, en modo multipozo", () => {
  const lote = generarLoteDeSistemas(NUM_SISTEMAS);

  for (const { semilla, sistema, naveA, naveB, aleatorio } of lote) {
    const parametrosComunes = {
      mascara: sistema.mascara,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      naves: [naveA, naveB],
      tiradorId: 0 as const,
      objetivoId: 1 as const,
    };

    const decision = decidirTurnoIA({
      mascara: sistema.mascara,
      origenX: naveA.x,
      objetivoX: naveB.x,
      origenY: naveA.y,
      objetivoY: naveB.y,
      planetas: sistema.planetas,
      naves: [naveA, naveB],
      tiradorId: 0,
      objetivoId: 1,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      personalidad: CHISPA,
      aleatorio,
      ultimoIntento: { distanciaAlObjetivoPx: 0, fallosConsecutivos: 0, turnosSeguidosSinDanio: 0 },
    });

    // Recalculado por fuera, con la misma semilla: "bloqueada" es el mismo
    // existeTiroViable que decidir.ts consulta (ia-n10), y con
    // turnosSeguidosSinDanio=0 y fallosConsecutivos=0 (fijados arriba) se sabe
    // sin ambigüedad si elegirArma consumió un tirón de aleatorio (caso
    // normal) o ninguno (bloqueada) -- sin necesitar reimplementar su política
    // de arma, que no es lo que este criterio verifica.
    const bloqueada = !existeTiroViable({
      ...parametrosComunes,
      aleatorio,
      arma: buscarArma(ARMA_BASE_ID),
      presupuestoIntentos: PRESUPUESTO_VIABILIDAD_REFERENCIA,
    });
    const aleatorioTrasArma = bloqueada ? aleatorio : siguienteAleatorio(aleatorio).estado;

    const resultadoBusqueda = buscarSolucionRival({
      ...parametrosComunes,
      aleatorio: aleatorioTrasArma,
      arma: buscarArma(decision.entrada.arma),
    });
    assert.equal(resultadoBusqueda.anguloGrados, decision.solucionExacta.anguloGrados, `semilla ${semilla}: solucionExacta.anguloGrados no reproducible`);
    assert.equal(resultadoBusqueda.potencia, decision.solucionExacta.potencia, `semilla ${semilla}: solucionExacta.potencia no reproducible`);

    const factorSensibilidadAngulo = calcularFactorSensibilidad(resultadoBusqueda.sensibilidadPxPorGrado);
    const magnitudMaximaErrorPotencia = Math.max(Math.abs(CHISPA.error.potencia.minimo), Math.abs(CHISPA.error.potencia.maximo));
    const factorSensibilidadPotencia = calcularFactorSensibilidadPotencia(
      resultadoBusqueda.sensibilidadPxPorPorcentajePotencia,
      magnitudMaximaErrorPotencia,
    );
    const { error, aleatorio: aleatorioFinal } = calcularErrorInyectado(CHISPA, aleatorioTrasArma, factorSensibilidadAngulo, factorSensibilidadPotencia);
    const anguloConError = Math.min(180, Math.max(0, decision.solucionExacta.anguloGrados + error.anguloGrados));
    const potenciaConError = Math.min(100, Math.max(0, decision.solucionExacta.potencia + error.potencia));

    // ia-autodanio-2: decidirTurnoIA ya no emite solucionExacta + error tal
    // cual -- antes de disparar re-simula y reintenta si ese tiro se
    // autoimpacta (evitarAutoimpactoConReintento). fallosConsecutivos y
    // turnosSeguidosSinDanio están fijados a 0 arriba, así que
    // factorBaseCorreccion = FACTOR_DE_CORRECCION**0 = 1, como en el resto de
    // este test.
    const resultadoEsperado = evitarAutoimpactoConReintento({
      ...parametrosComunes,
      origenX: naveA.x,
      origenY: naveA.y,
      objetivoX: naveB.x,
      objetivoY: naveB.y,
      arma: buscarArma(decision.entrada.arma),
      personalidad: CHISPA,
      solucionExacta: decision.solucionExacta,
      anguloInicial: anguloConError,
      potenciaInicial: potenciaConError,
      aleatorio: aleatorioFinal,
      factorSensibilidadAngulo,
      factorSensibilidadPotencia,
      factorBaseCorreccion: 1,
      vuelosYaSimulados: resultadoBusqueda.vuelosSimulados,
      presupuestoTotal: PRESUPUESTO_VUELOS_RIVAL_TURNO,
    });

    assert.equal(decision.entrada.anguloGrados, resultadoEsperado.anguloGrados, `semilla ${semilla}: ángulo no coincide con solución exacta + error (+ reintentos)`);
    assert.equal(decision.entrada.potencia, resultadoEsperado.potencia, `semilla ${semilla}: potencia no coincide con solución exacta + error (+ reintentos)`);
  }
});

// ia-n4b: dispersión = distancia 2D entre el punto de impacto de la solución
// EXACTA (sin degradar) y el de la entrada YA degradada por el error de
// personalidad, ambas resueltas con el resolutor real -- la misma noción de
// "cuánto se aparta el disparo de lo que la búsqueda pretendía" que decidir.ts
// amortigua con el factor de sensibilidad (ia-n5).
function medirDispersionMedia(personalidad: Personalidad, lote: ReturnType<typeof generarLoteDeSistemas>): number {
  const distancias: number[] = [];
  for (const { sistema, naveA, naveB, aleatorio } of lote) {
    const decision = decidirTurnoIA({
      mascara: sistema.mascara,
      origenX: naveA.x,
      objetivoX: naveB.x,
      origenY: naveA.y,
      objetivoY: naveB.y,
      planetas: sistema.planetas,
      naves: [naveA, naveB],
      tiradorId: 0,
      objetivoId: 1,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      personalidad,
      aleatorio,
      ultimoIntento: { distanciaAlObjetivoPx: 0, fallosConsecutivos: 0, turnosSeguidosSinDanio: 0 },
    });

    const arma = buscarArma(decision.entrada.arma);
    const parametrosVuelo = {
      mascara: sistema.mascara,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      aleatorio,
      arma,
      origenX: naveA.x,
      origenY: naveA.y,
      objetivoX: naveB.x,
      objetivoY: naveB.y,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      naves: [naveA, naveB],
      tiradorId: 0 as const,
    };
    const exacto = resolverDisparo({ ...parametrosVuelo, anguloGrados: decision.solucionExacta.anguloGrados, potencia: decision.solucionExacta.potencia });
    const degradado = resolverDisparo({ ...parametrosVuelo, anguloGrados: decision.entrada.anguloGrados, potencia: decision.entrada.potencia });
    const puntoExacto = exacto.puntosDeImpacto[0];
    const puntoDegradado = degradado.puntosDeImpacto[0];
    if (puntoExacto && puntoDegradado) {
      distancias.push(Math.hypot(puntoDegradado.x - puntoExacto.x, puntoDegradado.y - puntoExacto.y));
    }
  }
  return distancias.reduce((total, d) => total + d, 0) / distancias.length;
}

// ia-punteria-3: las bandas de dificultad que pide este bloque son de TASA
// DE VICTORIA contra el jugador patrón (ver tests/unit/ia/ia-punteria.test.ts),
// no de dispersión de puntería -- y Chispa pierde sobre todo por su catálogo
// de armas preferidas (42% de sus turnos con zanjadora-manolita, daño máximo
// 4), no por errar el tiro. Para que su banda de victoria (20-40%) no se
// vuelva a tapar con fallos de puntería encima del hándicap de armas, su
// rango de error se recorta mucho en personalidades.ts -- y eso, medido
// aquí, la deja con MENOS dispersión que Almirante Bisagra (cuyo error de
// potencia es grande y siempre positivo: "se pasa de fuerza" sigue siendo su
// sesgo real). El orden que queda demostrado no es ya "más floja = más
// dispersa", es el que resulta de los rangos de personalidades.ts
// recalibrados por ia-punteria: Chispa < La Contable < Almirante Bisagra.
// salida-pantalla: contra el jugador patrón nuevo (tiro trazado), los ±2° de
// Chispa la dejaban en 50-80 % de victorias, así que su rango sube a ±10°/±14
// y el orden pasa a La Contable < Chispa < Almirante Bisagra (medido: 86 / 167 /
// 293 px). La banda de victoria (ia-3) es lo que manda; este orden la sigue.
// Siempre 200 disparos, sin la reducción de muestra(): con 40 la media la
// mueven unos pocos tiros que un pozo lanza lejos (Chispa 106 px frente a La
// Contable 46 px) y el orden se invierte respecto al de la muestra completa.
const NUM_SISTEMAS_DISPERSION = 200;

test(`ia-n4b: la dispersión media en ${NUM_SISTEMAS_DISPERSION} disparos, en modo multipozo, refleja los rangos de error recalibrados`, () => {
  const lote = generarLoteDeSistemas(NUM_SISTEMAS_DISPERSION);

  const dispersionContable = medirDispersionMedia(LA_CONTABLE, lote);
  const dispersionBisagra = medirDispersionMedia(ALMIRANTE_BISAGRA, lote);
  const dispersionChispa = medirDispersionMedia(CHISPA, lote);

  console.log(
    `ia-n4b: dispersión media -- La Contable ${dispersionContable.toFixed(1)}px, Almirante Bisagra ${dispersionBisagra.toFixed(1)}px, Chispa ${dispersionChispa.toFixed(1)}px`,
  );
  assert.ok(dispersionContable < dispersionChispa, `La Contable (${dispersionContable}) debería tener menos dispersión que Chispa (${dispersionChispa}) con los rangos recalibrados`);
  assert.ok(dispersionChispa < dispersionBisagra, `Chispa (${dispersionChispa}) debería tener menos dispersión que Almirante Bisagra (${dispersionBisagra})`);
});
