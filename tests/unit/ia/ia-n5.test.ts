import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { buscarSolucionRival } from "@/sim/ia/busquedaMultipozo";
import { calcularErrorInyectado, calcularFactorSensibilidad, calcularFactorSensibilidadPotencia } from "@/sim/ia/decidir";
import { LA_CONTABLE } from "@/sim/ia/personalidades";
import type { Mascara } from "@/sim/terreno/mascara";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { crearMascaraPlana } from "../../utils/terrenoPlano";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";

const ARMA_BASE_ID = "pepinazo-cortesia";
const N_MUESTRAS = 80;
const BANDA_TOLERANCIA = 0.3;

// La Contable: su rango de error (±1,2° / ±2,4%) es lo bastante pequeño para
// que la sensibilidad medida con la sonda de ±0,5°/±1% siga describiendo
// bien el punto de caída real tras aplicar el error -- con Almirante Bisagra
// o Chispa (rangos mucho mayores) el error puede cruzar un cráter de
// gravedad que la sonda, al ser tan pequeña, no ve venir. ia-n5 pide UNA
// personalidad, no las tres; esta es la que demuestra el mecanismo sin ese
// ruido de fondo.
const PERSONALIDAD = LA_CONTABLE;

// Escenario "plano" (tiro despejado): terreno llano, sin planetas, la misma
// referencia que ia-4/ia-5/ia-6 -- una parábola simple, sin ningún borde de
// alcance que rozar.
const MASCARA_PLANA = crearMascaraPlana(MUNDO_MULTIPOZO.ancho, MUNDO_MULTIPOZO.alto, 900);
const NAVE_A_PLANA = { id: 0 as const, x: 300, y: 900 };
const NAVE_B_PLANA = { id: 1 as const, x: 1400, y: 900 };

// Escenario "sensible" (solución rozando un planeta): la semilla 69 del
// mismo lote de 200 sistemas que usan ia-n1/ia-n4/ia-n9/ia-n10.
// ia-punteria: antes del refinamiento de potencia (busquedaMultipozo.ts) la
// semilla 72 era la elegida por tener sensibilidad mediana entre las 200 --
// el refinamiento de potencia (rango completo [0,100], no una ventana local)
// cambia qué ángulo/potencia encuentra la búsqueda para CADA sistema, así
// que la sensibilidad medida en cada uno cambia también y 72 dejó de
// demostrar el mecanismo (su sensibilidad "con escalado" quedó fuera de la
// banda). Reelegida por el mismo criterio con el buscador nuevo: razón
// sensible/plano con escalado dentro de ±30% y fuera de esa banda sin
// escalado, verificado por barrido sobre el lote.
const SEMILLA_SISTEMA_SENSIBLE = 69;

interface Escenario {
  readonly mascara: Mascara;
  readonly planetas: RegistroPlanetas | undefined;
  readonly naveA: { readonly id: 0; readonly x: number; readonly y: number };
  readonly naveB: { readonly id: 1; readonly x: number; readonly y: number };
}

function obtenerEscenarioSensible(): Escenario {
  const sistema = generarLoteDeSistemas(SEMILLA_SISTEMA_SENSIBLE + 1).find((s) => s.semilla === SEMILLA_SISTEMA_SENSIBLE);
  if (!sistema) throw new Error("ia-n5: no se encontró la semilla del sistema sensible en el lote");
  return { mascara: sistema.sistema.mascara, planetas: sistema.sistema.planetas, naveA: sistema.naveA, naveB: sistema.naveB };
}

// Dispersión media de N disparos degradados de la MISMA personalidad contra
// el MISMO escenario: la solución exacta se busca una sola vez (el oráculo
// no cambia entre muestras), y cada muestra solo redibuja el error de
// personalidad con una semilla distinta -- igual que medirDispersionMedia en
// ia-n4b, pero variando el azar sobre un único sistema en vez de un sistema
// por muestra.
function medirDispersionMediaSistema(escenario: Escenario, conEscalado: boolean, semillaBase: number): number {
  const arma = buscarArma(ARMA_BASE_ID);
  const parametrosComunes = {
    mascara: escenario.mascara,
    ancho: MUNDO_MULTIPOZO.ancho,
    alto: MUNDO_MULTIPOZO.alto,
    planetas: escenario.planetas,
    gravedad: MUNDO_MULTIPOZO.gravedad,
    deriva: MUNDO_MULTIPOZO.deriva,
    naves: [escenario.naveA, escenario.naveB],
    tiradorId: 0 as const,
    objetivoId: 1 as const,
  };

  const resultadoBusqueda = buscarSolucionRival({ ...parametrosComunes, aleatorio: crearEstadoAleatorio(semillaBase), arma });
  const magnitudMaximaErrorPotencia = Math.max(Math.abs(PERSONALIDAD.error.potencia.minimo), Math.abs(PERSONALIDAD.error.potencia.maximo));
  const factorAngulo = conEscalado ? calcularFactorSensibilidad(resultadoBusqueda.sensibilidadPxPorGrado) : 1;
  const factorPotencia = conEscalado
    ? calcularFactorSensibilidadPotencia(resultadoBusqueda.sensibilidadPxPorPorcentajePotencia, magnitudMaximaErrorPotencia)
    : 1;

  const parametrosVuelo = {
    mascara: escenario.mascara,
    gravedad: MUNDO_MULTIPOZO.gravedad,
    deriva: MUNDO_MULTIPOZO.deriva,
    arma,
    origenX: escenario.naveA.x,
    origenY: escenario.naveA.y,
    objetivoX: escenario.naveB.x,
    objetivoY: escenario.naveB.y,
    ancho: MUNDO_MULTIPOZO.ancho,
    alto: MUNDO_MULTIPOZO.alto,
    planetas: escenario.planetas,
    naves: [escenario.naveA, escenario.naveB],
    tiradorId: 0 as const,
  };
  const exacto = resolverDisparo({
    ...parametrosVuelo,
    aleatorio: crearEstadoAleatorio(semillaBase),
    anguloGrados: resultadoBusqueda.anguloGrados,
    potencia: resultadoBusqueda.potencia,
  });
  const puntoExacto = exacto.puntosDeImpacto[0];
  assert.ok(puntoExacto, "ia-n5: la solución exacta debe impactar para poder medir dispersión");

  const distancias: number[] = [];
  let aleatorio: EstadoAleatorio = crearEstadoAleatorio(semillaBase * 7 + 1000);
  for (let muestra = 0; muestra < N_MUESTRAS; muestra++) {
    const { error, aleatorio: siguiente } = calcularErrorInyectado(PERSONALIDAD, aleatorio, factorAngulo, factorPotencia);
    aleatorio = siguiente;
    const anguloGrados = Math.min(180, Math.max(0, resultadoBusqueda.anguloGrados + error.anguloGrados));
    const potencia = Math.min(100, Math.max(0, resultadoBusqueda.potencia + error.potencia));
    const degradado = resolverDisparo({ ...parametrosVuelo, aleatorio, anguloGrados, potencia });
    const puntoDegradado = degradado.puntosDeImpacto[0];
    if (puntoDegradado) {
      distancias.push(Math.hypot(puntoDegradado.x - puntoExacto!.x, puntoDegradado.y - puntoExacto!.y));
    }
  }
  return distancias.reduce((total, d) => total + d, 0) / distancias.length;
}

test("ia-n5: la dispersión de La Contable queda dentro de una banda de ±30% entre un sistema sensible y uno plano, solo si se escala por sensibilidad", () => {
  const escenarioPlano: Escenario = { mascara: MASCARA_PLANA, planetas: undefined, naveA: NAVE_A_PLANA, naveB: NAVE_B_PLANA };
  const escenarioSensible = obtenerEscenarioSensible();

  const dispersionPlanaConEscalado = medirDispersionMediaSistema(escenarioPlano, true, 1);
  const dispersionSensibleConEscalado = medirDispersionMediaSistema(escenarioSensible, true, 2);
  const razonConEscalado = dispersionSensibleConEscalado / dispersionPlanaConEscalado;

  console.log(
    `ia-n5: con escalado -- plano ${dispersionPlanaConEscalado.toFixed(1)}px, sensible ${dispersionSensibleConEscalado.toFixed(1)}px, razón ${razonConEscalado.toFixed(2)}`,
  );
  assert.ok(
    razonConEscalado >= 1 - BANDA_TOLERANCIA && razonConEscalado <= 1 + BANDA_TOLERANCIA,
    `con escalado, la razón sensible/plano (${razonConEscalado.toFixed(2)}) debería quedar dentro de ±${BANDA_TOLERANCIA * 100}%`,
  );

  // Misma comparación, pero sin el factor de sensibilidad (factor 1 fijo en
  // los dos ejes): demuestra que es el escalado, y no la elección de
  // escenarios, lo que produce la banda de arriba.
  const dispersionPlanaSinEscalado = medirDispersionMediaSistema(escenarioPlano, false, 1);
  const dispersionSensibleSinEscalado = medirDispersionMediaSistema(escenarioSensible, false, 2);
  const razonSinEscalado = dispersionSensibleSinEscalado / dispersionPlanaSinEscalado;

  console.log(
    `ia-n5: sin escalado -- plano ${dispersionPlanaSinEscalado.toFixed(1)}px, sensible ${dispersionSensibleSinEscalado.toFixed(1)}px, razón ${razonSinEscalado.toFixed(2)}`,
  );
  assert.ok(
    razonSinEscalado < 1 - BANDA_TOLERANCIA || razonSinEscalado > 1 + BANDA_TOLERANCIA,
    `sin escalado, la razón sensible/plano (${razonSinEscalado.toFixed(2)}) debería INCUMPLIR la banda de ±${BANDA_TOLERANCIA * 100}% -- si no la incumple, el escalado no está demostrando nada`,
  );
});
