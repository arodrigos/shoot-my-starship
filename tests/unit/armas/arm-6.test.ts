import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio, siguienteAleatorio } from "@/sim/aleatorio";
import { colocarNaves } from "@/sim/naves/colocacion";
import { jugarTurno } from "@/sim/partida/motor";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { siguienteUltimoIntentoIA, type UltimoIntentoIA } from "@/sim/ia/decidir";
import { PERSONALIDADES } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import type { EstadoPartida, FuenteDeTurno, IdNave, ParametrosMundo } from "@/sim/partida/tipos";

// Reproduce el 2-naves fijo de este test (nunca el núcleo, que ya es de N
// naves desde nucleo-n-naves).
function rivalDe(id: IdNave): IdNave {
  return id === 0 ? 1 : 0;
}
import { reiniciarContadorVuelosSimulados, vuelosSimuladosTotales } from "@/sim/fisica/vuelo";
import { buscarArma } from "@/sim/armas/catalogo";
import { buscarSolucionRival, PRESUPUESTO_VUELOS_RIVAL_TURNO } from "@/sim/ia/busquedaMultipozo";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";
import { minimoProporcional, muestra } from "../../utils/muestra";

// arm-6: repite EXACTAMENTE el escenario de ia-n7 (tests/unit/partida/
// partida-3.test.ts) con el catálogo ya crecido a 13 armas -- incluidas las
// tres de ráfaga/penetración/láser, que ahora puede elegir elegirArma() sin
// que este test tenga que saber nada de sus ids. No se reutiliza el fichero
// de partida-3 por import porque su harness no exporta nada: se reproduce
// aquí a propósito, para que la comparación de presupuesto de cómputo
// (antes/después del catálogo nuevo) sea posible dentro del mismo test.
const SEMILLA_MAESTRA = 90210;
const NUMERO_DE_PARTIDAS = muestra(200);
const TURNOS_MAXIMOS = 40;
const LIMITE_TURNOS_SEGURIDAD = 800;
const TECHO_PROPORCION_PROYECTIL_PERDIDO = 0.15;
// Presupuesto de vuelos simulados por partida: el mismo orden de magnitud
// que colocarNaves ya usa como tope (6.000, imp-10) multiplicado por un
// margen generoso para 40 turnos de ráfaga real (hasta 3 vuelos por disparo
// de Andanada) -- si esto se dispara, "añadir armas" ha roto en silencio el
// presupuesto de cómputo del solucionador.
const PRESUPUESTO_VUELOS_POR_PARTIDA = 250_000;

const MUNDO_ESPACIAL: ParametrosMundo = {
  ancho: MUNDO_ANCHO,
  alto: MUNDO_ALTO,
  gravedad: 1,
  deriva: 0,
  etiquetaDeriva: "Vacío: aquí no empuja nada que no sea un planeta",
};

interface ResultadoPartidaEspacial {
  readonly turnos: number;
  readonly disparos: number;
  readonly proyectilesPerdidos: number;
  readonly vuelosSimulados: number;
}

function jugarPartidaEspacial(personalidades: readonly [Personalidad, Personalidad], semillaSistema: number): ResultadoPartidaEspacial {
  const colocacion = colocarNaves(semillaSistema, MUNDO_ESPACIAL, crearEstadoAleatorio(semillaSistema));
  let estado: EstadoPartida = {
    version: 1,
    mundo: MUNDO_ESPACIAL,
    mascara: colocacion.sistema.mascara,
    naves: colocacion.naves,
    ordenTurno: [0, 1],
    turno: 0,
    numeroTurno: 0,
    aleatorio: colocacion.aleatorio,
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
  };

  const ultimoIntento: [UltimoIntentoIA | null, UltimoIntentoIA | null] = [null, null];
  let disparos = 0;
  let proyectilesPerdidos = 0;
  const vuelosAntes = vuelosSimuladosTotales();

  while (estado.resultado.tipo === "en-curso") {
    assert.equal(
      estado.numeroTurno < LIMITE_TURNOS_SEGURIDAD,
      true,
      `partida sin ganador tras ${LIMITE_TURNOS_SEGURIDAD} turnos (semilla ${semillaSistema}, ${personalidades[0].nombre} vs ${personalidades[1].nombre})`,
    );

    const tirador = estado.turno;
    const objetivoId = rivalDe(tirador);
    const objetivoAntes = estado.naves[objetivoId];
    const objetivoYAntes = objetivoAntes.y as number;

    const fuentes: [FuenteDeTurno, FuenteDeTurno] = [
      crearFuenteIA(personalidades[0], ultimoIntento[0]),
      crearFuenteIA(personalidades[1], ultimoIntento[1]),
    ];
    const { estado: estadoDespues, eventos } = jugarTurno(estado, fuentes);
    estado = estadoDespues;
    disparos++;

    if (eventos.some((evento) => evento.tipo === "proyectil-perdido")) {
      proyectilesPerdidos++;
    }

    const eventoImpacto = eventos.find((evento): evento is Extract<(typeof eventos)[number], { tipo: "impacto" }> => evento.tipo === "impacto");
    const puntoDeCaida = eventoImpacto ?? { x: objetivoAntes.x, y: objetivoYAntes };
    const distancia = Math.hypot(puntoDeCaida.x - objetivoAntes.x, puntoDeCaida.y - objetivoYAntes);

    const danioCausado = eventos
      .filter((evento): evento is Extract<(typeof eventos)[number], { tipo: "impacto" }> => evento.tipo === "impacto" && evento.objetivo === objetivoId)
      .reduce((total, evento) => total + evento.danio, 0);

    // arm-6 (Gatekeeper): usa el MISMO cálculo que partida-3.test.ts y
    // Partida.ts en vez de reinventarlo -- este harness fue el que se olvidó
    // de llevar turnosSeguidosDanioInsuficiente y por eso "desistir de cavar"
    // (ia-n7) nunca se disparaba aquí.
    ultimoIntento[tirador] = siguienteUltimoIntentoIA(ultimoIntento[tirador], distancia, danioCausado);
  }

  return { turnos: estado.numeroTurno, disparos, proyectilesPerdidos, vuelosSimulados: vuelosSimuladosTotales() - vuelosAntes };
}

test(`arm-6: las ${NUMERO_DE_PARTIDAS} partidas de ia-n7 con el catálogo de 13 armas siguen dentro del presupuesto de cómputo, y casi todas terminan en 40 turnos o menos`, async (t) => {
  reiniciarContadorVuelosSimulados();
  let estadoAleatorio = crearEstadoAleatorio(SEMILLA_MAESTRA);
  const resultados: { readonly turnos: number; readonly disparos: number; readonly proyectilesPerdidos: number; readonly vuelosSimulados: number; readonly pareja: string }[] = [];

  for (let i = 0; i < NUMERO_DE_PARTIDAS; i++) {
    const paso = siguienteAleatorio(estadoAleatorio);
    estadoAleatorio = paso.estado;
    const semillaSistema = Math.floor(paso.valor * 0xffffffff);
    const personalidadA = PERSONALIDADES[i % PERSONALIDADES.length];
    const personalidadB = PERSONALIDADES[(i + 1) % PERSONALIDADES.length];
    const resultado = jugarPartidaEspacial([personalidadA, personalidadB], semillaSistema);
    resultados.push({ ...resultado, pareja: `${personalidadA.nombre} vs ${personalidadB.nombre}` });
  }

  const turnos = resultados.map((r) => r.turnos);
  const maximoTurnos = Math.max(...turnos);
  const sobreElLimite = resultados.filter((r) => r.turnos > TURNOS_MAXIMOS);
  const disparosTotales = resultados.reduce((total, r) => total + r.disparos, 0);
  const proyectilesPerdidosTotales = resultados.reduce((total, r) => total + r.proyectilesPerdidos, 0);
  const proporcionPerdidos = proyectilesPerdidosTotales / disparosTotales;
  const maximoVuelosPorPartida = Math.max(...resultados.map((r) => r.vuelosSimulados));

  console.log(`arm-6: máximo ${maximoTurnos} turnos de ${NUMERO_DE_PARTIDAS} partidas con el catálogo de 13 armas`);
  console.log(`arm-6: ${proyectilesPerdidosTotales} de ${disparosTotales} disparos acaban en proyectil perdido (${(proporcionPerdidos * 100).toFixed(1)}%)`);
  console.log(`arm-6: máximo de vuelos simulados en una sola partida: ${maximoVuelosPorPartida} (presupuesto ${PRESUPUESTO_VUELOS_POR_PARTIDA})`);

  await t.test("el presupuesto de cómputo (vuelos simulados por partida) se mantiene con las armas de ráfaga", () => {
    assert.ok(
      maximoVuelosPorPartida < PRESUPUESTO_VUELOS_POR_PARTIDA,
      `una partida ha simulado ${maximoVuelosPorPartida} vuelos, presupuesto ${PRESUPUESTO_VUELOS_POR_PARTIDA}`,
    );
  });

  await t.test(`menos del ${TECHO_PROPORCION_PROYECTIL_PERDIDO * 100}% de los disparos acaban en proyectil perdido`, () => {
    assert.ok(
      proporcionPerdidos < TECHO_PROPORCION_PROYECTIL_PERDIDO,
      `${(proporcionPerdidos * 100).toFixed(1)}% de los disparos acaban en proyectil perdido, techo ${TECHO_PROPORCION_PROYECTIL_PERDIDO * 100}%`,
    );
  });

  // arm-6 (Gatekeeper, devuelto 3 veces): el { todo } venía de que este
  // harness no llevaba turnosSeguidosDanioInsuficiente, así que "desistir de
  // cavar" (ia-n7) nunca se disparaba aquí y el catálogo de 13 armas seguía
  // ejerciendo la IA anterior al arreglo. Con siguienteUltimoIntentoIA (el
  // mismo cálculo que ia-n7 ya usa en partida-3.test.ts y Partida.ts) el
  // máximo medido baja de 203 a 17 turnos sobre las mismas 200 partidas: se
  // retira el TODO porque ya no hereda ninguna tensión, se comprueba de
  // verdad.
  await t.test(`todas las partidas terminan en ${TURNOS_MAXIMOS} turnos o menos`, () => {
    assert.equal(maximoTurnos <= TURNOS_MAXIMOS, true, `${sobreElLimite.length} partida(s) superaron ${TURNOS_MAXIMOS} turnos: ${JSON.stringify(sobreElLimite)}`);
  });
});

// arm-6 (Gatekeeper, segunda mitad del hallazgo): elegirArma() nunca llega a
// las armas nuevas en juego libre -- están en la posición 3+ de
// ordenPreferenciaArmas de cada personalidad, y esa posición es
// estadísticamente inalcanzable salvo por "desistir de cavar". Tocar
// ordenPreferenciaArmas para forzarlas sería el camino directo, pero
// rompería el calibrado de ia-3.test.ts (las bandas de victoria de las tres
// personalidades están medidas a pocos puntos del suelo). Se sigue en su
// lugar la alternativa barata que da el propio feedback: forzar cada arma
// nueva de forma explícita como parámetro de buscarSolucionRival -- que es
// el mismo resolutor que usa el rival real, sin pasar por elegirArma() -- y
// comprobar que el presupuesto de vuelos se respeta y que sigue encontrando
// daño real con cada una.
const NUM_SISTEMAS_ARMAS_NUEVAS_COMPLETO = 150;
const NUM_SISTEMAS_ARMAS_NUEVAS = muestra(NUM_SISTEMAS_ARMAS_NUEVAS_COMPLETO);
// andanada-de-flechas y barrena-planetaria siguen una parábola normal (la
// gravedad las cura alrededor de los planetas, igual que a cualquier otra
// arma del catálogo), así que se les exige el mismo listón que ia-n1. El
// rayo-laser es la excepción de diseño (arm-4): vuela en línea recta e
// inmune a la gravedad, así que solo acierta cuando hay línea de visión
// directa -- en un sistema multipozo aleatorio con hasta 6 planetas de por
// medio, eso falla a menudo por geometría, no porque la búsqueda esté rota.
// El listón bajo del láser es del acierto real medido (53/150), no un
// número arbitrario: exige que la búsqueda siga encontrando el disparo
// cuando sí hay línea de visión, sin fingir que la tiene cuando no.
// Mínimos sobre los 150 sistemas completos; con muestra reducida se exige
// la misma proporción (minimoProporcional).
const MINIMOS_CON_DANIO: Record<string, number> = {
  "andanada-de-flechas": 130,
  "barrena-planetaria": 130,
  "rayo-laser": 40,
};

test("arm-6: la búsqueda del rival respeta el presupuesto de vuelos y sigue encontrando daño con las tres armas nuevas", () => {
  const lote = generarLoteDeSistemas(NUM_SISTEMAS_ARMAS_NUEVAS, MUNDO_MULTIPOZO);

  for (const idArma of Object.keys(MINIMOS_CON_DANIO)) {
    const arma = buscarArma(idArma);
    let conDanio = 0;
    let maximoVuelos = 0;
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
        arma,
        naves: [naveA, naveB],
        tiradorId: 0,
        objetivoId: 1,
      });
      maximoVuelos = Math.max(maximoVuelos, resultado.vuelosSimulados);
      if (resultado.danioObjetivo > 0) conDanio++;
      else fallos.push(semilla);
    }

    console.log(
      `arm-6 (${idArma}): ${conDanio}/${NUM_SISTEMAS_ARMAS_NUEVAS} con daño real, máximo ${maximoVuelos} vuelos simulados (presupuesto ${PRESUPUESTO_VUELOS_RIVAL_TURNO}) (fallos: ${JSON.stringify(fallos)})`,
    );

    assert.ok(
      maximoVuelos <= PRESUPUESTO_VUELOS_RIVAL_TURNO,
      `${idArma}: una búsqueda ha simulado ${maximoVuelos} vuelos, presupuesto ${PRESUPUESTO_VUELOS_RIVAL_TURNO}`,
    );
    const minimoConDanio = minimoProporcional(MINIMOS_CON_DANIO[idArma], NUM_SISTEMAS_ARMAS_NUEVAS_COMPLETO, NUM_SISTEMAS_ARMAS_NUEVAS);
    assert.ok(
      conDanio >= minimoConDanio,
      `${idArma}: solo ${conDanio}/${NUM_SISTEMAS_ARMAS_NUEVAS} sistemas obtuvieron un disparo con daño real (mínimo exigido ${minimoConDanio})`,
    );
  }
});
